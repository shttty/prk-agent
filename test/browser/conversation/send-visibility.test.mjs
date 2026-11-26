import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

const input = "#composer";
const send = "#send-message";
const transcript = "#messages .pi-message-user";
const lostReply = "Admitted, reply lost";
const resent = "Resent once";

test("a sent message stays visible in the locked draft, the SDK queue or the conversation", async (t) => {
  const release = Promise.withResolvers();
  // Turns that stay running until the unknown-send checks release them.
  const holds = new Map([lostReply].map((message) => [message, Promise.withResolvers()]));
  const f = await browserFixture(t, { config: { session: { workerTools: "direct", idleTimeoutMs: 1_500 } }, async answer(context) {
    if (text(context.messages.at(-1)) === "Hold this turn") await release.promise;
    await holds.get(text(context.messages.at(-1)))?.promise;
    return fauxAssistantMessage("Controlled response");
  } });
  const idle = await f.create("Idle send");
  const sleeping = await f.create("Sleeping send");
  try {
    await f.open(idle);
    await f.page.locator(input).focus();
    await f.page.locator(`${input}[data-status="idle"]`).waitFor();
    const first = await submit(f, idle, "idle");
    await assertHandoff(f, first);
    await f.complete(idle, first.receipt);
    await assertUnknownSends(f, idle, holds);
    const running = await f.create("Running send");
    const started = await f.send(running, "Hold this turn");
    await f.open(running);
    await f.page.locator("#composer-form[data-busy]").waitFor();
    const events = [];
    f.client.onEvent((event) => { if (event.sessionId === running) events.push(event); });
    await f.request("subscribe", { sessionId: running });
    const steer = await submit(f, running, "steer", "steer");
    const follow = await submit(f, running, "followUp", "followUp");
    assert.deepEqual(f.state(running).queuedMessages, { steering: [steer.message], followUp: [follow.message] });
    release.resolve();
    await f.complete(running, started);
    for (const sent of [steer, follow]) {
      await assertHandoff(f, sent);
      // A fast browser can coalesce these SDK events into one paint; still require the real transfer frame.
      const delivery = events.find((event) => event.details?.sdkType === "queue_update" && event.details.receivingUserText === sent.message);
      const finished = events.find((event) => event.details?.sdkType === "message_end" && text(event.details.message) === sent.message);
      assert(delivery && delivery.sequence < finished?.sequence, `SDK receiving text missing for ${sent.message}`);
      t.diagnostic(`SDK ${sent.message}: queue handoff to message_end ${Date.parse(finished.timestamp) - Date.parse(delivery.timestamp)} ms`);
    }
    await until(async () => (await f.request("state", { sessionId: sleeping })).state === "sleeping", "fixture session sleeping");
    const wake = Promise.withResolvers();
    await f.page.route(`**/api/sessions/${sleeping}/wake`, async (route) => { await wake.promise; await route.continue(); });
    try {
      await f.page.setViewportSize({ width: 390, height: 844 });
      await f.open(sleeping);
      await f.page.locator(`${input}[data-status="sleeping"]`).waitFor();
      const last = await submit(f, sleeping, "sleeping");
      await assertHandoff(f, last);
      await f.complete(sleeping, last.receipt);
    } finally { wake.resolve(); }
  } finally {
    release.resolve();
    for (const hold of holds.values()) hold.resolve();
  }
});

async function submit(f, id, label, mode) {
  const message = `Sent from ${label}`;
  const path = `/api/sessions/${id}/send`;
  await f.page.locator(input).fill(message);
  await f.page.evaluate(({ input, send, transcript, message, mode }) => {
    const queue = ".pi-pending-queue li";
    const count = (selector) => [...document.querySelectorAll(selector)].filter((node) => node.checkVisibility() && node.textContent.includes(message)).length;
    const begin = () => {
      const start = performance.now();
      const samples = [];
      (window.sendMeasures ??= {})[message] = { samples, start: performance.timeOrigin + start };
      const sample = () => {
        const composer = document.querySelector(input);
        const status = document.querySelector(".pi-send-status")?.dataset.state;
        const draft = composer?.value === message;
        const sending = Boolean(composer?.readOnly && composer.hasAttribute("data-sending") && ["waking", "sending"].includes(status));
        const queueCopies = count(queue);
        const receiving = count(".pi-pending-queue [data-stage=receiving] li");
        const body = count(transcript);
        const elapsed = +(performance.now() - start).toFixed(1);
        samples.push({ ms: elapsed, draft, sending, queue: queueCopies, receiving, body });
        if (elapsed < 3_000 && !(body === 1 && !draft && !queueCopies)) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    };
    if (mode === "followUp") {
      const onEnter = (event) => { if (event.key === "Enter") { event.currentTarget.removeEventListener("keydown", onEnter, true); begin(); } };
      document.querySelector(input).addEventListener("keydown", onEnter, true);
    } else document.querySelector(send).addEventListener("click", begin, { once: true, capture: true });
  }, { input, send, transcript, message, mode });
  const response = f.page.waitForResponse((res) => res.request().method() === "POST" && new URL(res.url()).pathname === path);
  if (mode === "followUp") await f.page.locator(input).press("Control+Enter");
  else await f.page.locator(send).click();
  const reply = await response;
  const receipt = await reply.json();
  assert.equal(receipt.accepted, true, JSON.stringify(receipt));
  assert.equal(reply.request().postDataJSON().queue, mode);
  await f.page.waitForFunction(({ message, input }) => document.querySelector(input)?.value !== message, { message, input });
  const { startTime, responseEnd } = reply.request().timing();
  return { message, receipt, responseAt: responseEnd >= 0 ? startTime + responseEnd : null };
}

async function assertHandoff(f, { message, responseAt }) {
  await f.page.locator(transcript).filter({ hasText: message }).waitFor();
  await f.page.waitForFunction((message) => window.sendMeasures[message]?.samples.at(-1)?.body === 1, message);
  const { samples, start } = await f.page.evaluate((message) => window.sendMeasures[message], message);
  const changes = samples.filter(({ ms: _ms, ...state }, i) => !i || Object.entries(state).some(([k, v]) => samples[i - 1][k] !== v));
  console.log("SEND MEASURE", message, "HTTP complete ms", responseAt && +(responseAt - start).toFixed(1), JSON.stringify(changes));
  for (const sample of samples) {
    const copies = Number(sample.draft) + sample.queue + sample.body;
    assert(copies >= 1, `input invisible at ${JSON.stringify(sample)}`);
    assert(!sample.draft || sample.sending, `draft editable or not marked as sending at ${JSON.stringify(sample)}`);
    // SDK stream and HTTP send receipt travel independently. The locked original draft may briefly coexist
    // with the SDK projection until this client applies the receipt; the projection itself must never duplicate.
    assert(sample.queue + sample.body <= 1, `SDK projection duplicated at ${JSON.stringify(sample)}`);
  }
  const overlap = samples.filter((sample) => sample.draft && (sample.queue || sample.body));
  if (overlap.length) {
    const cleared = samples.find((sample) => !sample.draft && sample.ms > overlap[0].ms);
    assert(cleared && cleared.ms - overlap[0].ms <= 100, `receipt overlap exceeded 100 ms: ${JSON.stringify(overlap)}`);
  }
  assert.equal(await f.page.locator(transcript).filter({ hasText: message }).count(), 1);
}

// A send whose HTTP reply never arrives: one notice by the composer, kept across a reload, then settled from the
// Gateway's record of that requestId — never sent twice.
async function assertUnknownSends(f, id, holds) {
  const unknown = f.page.locator(".pi-send-status[data-state=unknown]");
  const reload = async () => { await f.page.reload(); await f.page.locator("#chat-model-select:not(:disabled)").waitFor(); };
  // Status queries wait until released, as while the connection is still down; sleep snapshots cannot settle early.
  const holdStatus = async () => {
    const gate = Promise.withResolvers();
    await f.page.route(`**/api/sessions/${id}/send-status`, async (route) => { await gate.promise; await route.continue().catch(() => {}); });
    return () => gate.resolve();
  };
  let release = await holdStatus();
  await f.page.route(`**/api/sessions/${id}/send`, (route) => route.abort("connectionreset"), { times: 1 });
  await f.page.locator(input).fill("Lost before arrival");
  await f.page.locator(send).click();
  await unknown.waitFor();
  await f.page.locator("[data-action=resend-unknown]").waitFor();
  await f.page.locator("[data-action=restore-unknown]").waitFor();
  assert.equal(await f.page.locator("#session-banners > *").count(), 0, "the unknown send is reported once, by the composer");
  await reload();
  release();
  await f.page.locator("#restored-draft-status[data-reason=undelivered]").waitFor();
  assert.equal(await f.page.locator(input).inputValue(), "Lost before arrival");
  assert.equal(await unknown.count(), 0);
  await f.page.unroute(`**/api/sessions/${id}/send-status`);

  // Admitted, but the reply is lost: whichever settles it (request_accepted, a snapshot after the reload, or the
  // status query), the composer copy goes and the message is there once.
  const replied = Promise.withResolvers();
  await f.page.route(`**/api/sessions/${id}/send`, async (route) => { await route.fetch(); await route.abort("connectionreset"); replied.resolve(); }, { times: 1 });
  await f.page.locator(input).fill(lostReply);
  await f.page.locator(send).click();
  await replied.promise;
  await f.page.locator(`${input}:not([data-sending])`).waitFor();
  await reload();
  await f.page.waitForFunction((input) => document.querySelector(input)?.value === "", input);
  assert.equal(await unknown.count(), 0);
  holds.get(lostReply).resolve();
  await f.page.locator(transcript).filter({ hasText: lostReply }).waitFor();

  // Resend while the original is still on its way: the status query withdraws it, so its late arrival is refused.
  release = await holdStatus();
  const original = Promise.withResolvers();
  await f.page.route(`**/api/sessions/${id}/send`, (route) => { original.resolve(route.request().postDataJSON()); return route.abort("connectionreset"); }, { times: 1 });
  await f.page.locator(input).fill(resent);
  await f.page.locator(send).click();
  await f.page.locator("[data-action=resend-unknown]").click();
  release();
  await f.page.locator(transcript).filter({ hasText: resent }).waitFor();
  await f.page.waitForFunction((input) => document.querySelector(input)?.value === "", input);
  const late = await f.request("send", { ...(await original.promise), sessionId: id });
  assert.equal(late.accepted, false, JSON.stringify(late));
  await f.page.unroute(`**/api/sessions/${id}/send-status`);
  await reload();
  await f.page.locator(transcript).filter({ hasText: resent }).waitFor();
  for (const message of [lostReply, resent]) assert.equal(await f.page.locator(transcript).filter({ hasText: message }).count(), 1, message);
  assert.equal(await unknown.count(), 0);
}

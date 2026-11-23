// Page start, session selection and re-selecting the live session take the subscription's first snapshot as their only
// base (no GET before subscribing); a subscription refused before its first frame reports its error code as an SSE
// `error` event, which the page shows in the connection banner.
import assert from "node:assert/strict";
import { withRequestWorkbench } from "./request-trim/launch-request-workbench.mjs";

await withRequestWorkbench(async ({ ui, page, requests, settle, session, createSession, errors }) => {
  const sessionId = await createSession("Subscription base");
  const path = session(sessionId);
  const counts = {};
  let mark = requests.mark();
  await page.goto(ui.url);
  await page.locator(`[data-session-id="${sessionId}"]`).first().waitFor();
  await settle();
  counts.start = { workbench: requests.since(mark, "GET", "/api/workbench"), collection: requests.since(mark, "GET", "/api/sessions/events") };

  mark = requests.mark();
  await page.locator(`[data-session-id="${sessionId}"]`).first().click();
  await page.waitForFunction(() => document.querySelector("#chat-thinking-select")?.disabled === false);
  await settle();
  counts.select = { state: requests.since(mark, "GET", path), events: requests.since(mark, "GET", `${path}/events`) };

  mark = requests.mark();
  await page.locator(`[data-session-id="${sessionId}"]`).first().click();
  await settle();
  counts.reselect = { state: requests.since(mark, "GET", path), events: requests.since(mark, "GET", `${path}/events`) };
  console.log(`REQTRIM subscription-base ${JSON.stringify(counts)}`);
  assert.deepEqual(counts, { start: { workbench: 0, collection: 1 }, select: { state: 0, events: 1 }, reselect: { state: 0, events: 0 } });

  // Boundary: an unknown session is refused before any snapshot, with the Gateway's code.
  const refused = await page.evaluate(() => new Promise((done) => {
    const source = new EventSource("/api/sessions/missing-session/events");
    const seen = [];
    source.addEventListener("snapshot", () => seen.push("snapshot"));
    source.addEventListener("error", (event) => {
      source.close();
      done({ seen, frame: typeof event.data === "string" ? JSON.parse(event.data) : null });
    });
  }));
  assert.deepEqual(refused.seen, []);
  assert.equal(refused.frame?.code, "NOT_FOUND");
  assert.equal(typeof refused.frame?.error, "string");

  // Page: a refused subscription ends in the connection banner with that code, not an endless retry.
  const other = await createSession("Refused subscription");
  await page.route(`**${session(other)}/events`, (route) => route.fulfill({ status: 200, contentType: "text/event-stream",
    body: `event: error\ndata: ${JSON.stringify({ error: "refused by test", code: "BUSY" })}\n\n` }));
  await page.locator(`[data-session-id="${other}"]`).first().click();
  await page.locator('#connection-banner[data-code="BUSY"]').waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS request trim: subscription first frame is the only base; refusals keep their code");
});

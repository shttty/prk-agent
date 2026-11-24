import assert from "node:assert/strict";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { openSession, withRequestWorkbench } from "./request-trim/launch-request-workbench.mjs";

await withRequestWorkbench(async ({ root, host, client, ui, page, provider, session, createSession, requests, errors }) => {
  await prepareGatewayEnvironment(host, root, "fixture");
  const selected = await createSession("Selected session");
  const background = await createSession("Background session");
  const row = (id) => `.management-session-row[data-session-id="${id}"]`;
  const expectBackgroundState = async (state) => {
    await page.locator(`${row(background)}[data-status="${state}"]:not([aria-current])`).waitFor({ timeout: 5_000 });
    assert.equal(await page.locator(row(selected)).getAttribute("aria-current"), "true");
  };

  await openSession(page, ui.url, selected);
  await expectBackgroundState("idle");
  const mark = requests.mark();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  provider.setResponses([async () => {
    entered.resolve();
    await release.promise;
    return fauxAssistantMessage("Background reply finished.");
  }]);
  try {
    const accepted = await client.request("send", { sessionId: background, requestId: "background", message: "Run in the background", mode: "plain" });
    assert.equal(accepted.accepted, true);
    let timeout;
    try {
      await Promise.race([entered.promise, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Background provider did not start")), 10_000); })]);
    } finally {
      clearTimeout(timeout);
    }
    assert.equal(host.session(background).getSnapshot().state, "running", "The Gateway is running the background session");
    await expectBackgroundState("running");
  } finally {
    release.resolve();
  }
  await expectBackgroundState("idle");
  assert.equal(requests.since(mark, "GET", `${session(background)}/events`), 0, "The page never opens a background chat stream");
  assert.equal(requests.since(mark, "GET", /^\/api\/(?:workbench|sessions\/events)$/), 0, "The existing workbench stream updates the row without a reload");
  assert.deepEqual(errors, []);
  console.log("PASS: background session row updates idle → running → idle without selection or a workbench reload");
});

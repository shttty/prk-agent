// Settings-class native actions (local-tools, reload) take their result from the POST and server-pushed events:
// no serial refetch of the session snapshot, only event-driven catalog reads, and reload's pushed snapshot moves the
// page onto the Gateway's current stream.
import assert from "node:assert/strict";
import { withRequestWorkbench, openSession } from "./request-trim/launch-request-workbench.mjs";
import { openSessionDetails, closeSessionDetails } from "../fixtures/session-details.mjs";

await withRequestWorkbench(async ({ client, ui, page, requests, settle, session, createSession, errors }) => {
  const sessionId = await createSession("Native settings");
  const path = session(sessionId);
  await openSession(page, ui.url, sessionId);
  const counts = {};
  const posted = (action) => page.waitForResponse((response) => new URL(response.url()).pathname === `${path}/native`
    && response.request().method() === "POST" && response.request().postDataJSON().action === action);

  await openSessionDetails(page, sessionId);
  let mark = requests.mark();
  const localTools = posted("local-tools");
  await page.locator("#chat-local-tools").click();
  assert.equal((await (await localTools).json()).status, "completed");
  await settle();
  counts.localTools = { state: requests.since(mark, "GET", path), native: requests.since(mark, "GET", `${path}/native`) };
  await closeSessionDetails(page);

  await page.locator(`[data-session-id="${sessionId}"] [data-action="session-menu"]`).click();
  mark = requests.mark();
  const reload = posted("reload");
  await page.locator("#reload-session").click();
  assert.equal((await (await reload).json()).status, "completed");
  await settle();
  counts.reload = { state: requests.since(mark, "GET", path), native: requests.since(mark, "GET", `${path}/native`) };
  console.log(`REQTRIM native-settings ${JSON.stringify(counts)}`);

  // Reload's two catalog reads are both server-pushed: the new-stream snapshot and session_capabilities_changed.
  for (const [action, value] of Object.entries(counts)) {
    assert.equal(value.state, 0, `${action} does not refetch the session snapshot`);
    assert.ok(value.native <= (action === "reload" ? 2 : 1), `${action} native catalog reads (got ${value.native})`);
  }
  const { streamId } = await client.request("state", { sessionId });
  await openSessionDetails(page, sessionId);
  assert.equal(await page.locator("#sequence-state").getAttribute("data-stream-id"), streamId, "reload's pushed snapshot carries the page onto the current stream");
  assert.deepEqual(errors, []);
  console.log("PASS request trim: settings native actions use POST data and pushed events");
});

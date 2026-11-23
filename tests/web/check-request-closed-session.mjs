// Opening a closed session reads that one session (its history view) instead of the whole workbench, and does not
// subscribe to it.
import assert from "node:assert/strict";
import { withRequestWorkbench } from "./request-trim/launch-request-workbench.mjs";

await withRequestWorkbench(async ({ client, ui, page, requests, settle, session, createSession, errors }) => {
  const closed = await createSession("Closed history");
  await client.request("closeSession", { sessionId: closed });
  await page.goto(ui.url);
  await page.locator(`[data-session-id="${closed}"]`).first().waitFor();
  await settle();
  const mark = requests.mark();
  await page.locator(`[data-session-id="${closed}"]`).first().click();
  await page.waitForFunction(() => document.querySelector("#composer")?.getAttribute("data-status") === "closed");
  await settle();
  const path = session(closed);
  const counts = { workbench: requests.since(mark, "GET", "/api/workbench"), history: requests.since(mark, "GET", `${path}/history`), events: requests.since(mark, "GET", `${path}/events`) };
  console.log(`REQTRIM closed-session ${JSON.stringify(counts)}`);
  assert.deepEqual(counts, { workbench: 0, history: 1, events: 0 });
  assert.deepEqual(errors, []);
  console.log("PASS request trim: closed sessions open from one session read");
});

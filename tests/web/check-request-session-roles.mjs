// Root/supervisor roles arrive with the workbench snapshot and role events; the page never reads a separate
// session-control endpoint, at start or when another client moves the root.
import assert from "node:assert/strict";
import { withRequestWorkbench } from "./request-trim/launch-request-workbench.mjs";

await withRequestWorkbench(async ({ client, ui, page, requests, settle, createSession, errors }) => {
  const first = await createSession("Root first");
  const second = await createSession("Root second");
  await client.request("setSessionRoot", { sessionId: first });
  const badge = (sessionId) => page.locator(`[data-session-id="${sessionId}"] [data-role="root"]`);
  const mark = requests.mark();
  await page.goto(ui.url);
  await badge(first).waitFor();
  await client.request("setSessionRoot", { sessionId: second });
  await badge(second).waitFor();
  await badge(first).waitFor({ state: "detached" });
  await settle();
  const counts = { sessionControl: requests.since(mark, "GET", "/api/session-control"), workbench: requests.since(mark, "GET", "/api/workbench") };
  console.log(`REQTRIM session-roles ${JSON.stringify(counts)}`);
  assert.deepEqual(counts, { sessionControl: 0, workbench: 0 });
  assert.deepEqual(errors, []);
  console.log("PASS request trim: roles come from the workbench snapshot and role events");
});

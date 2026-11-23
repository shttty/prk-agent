// Creating a session from the page uses the POST's row and snapshot: after the POST the only session/workbench reads
// are the new session's live subscription and its native catalog.
import assert from "node:assert/strict";
import { withRequestWorkbench } from "./request-trim/launch-request-workbench.mjs";

await withRequestWorkbench(async ({ ui, page, requests, settle, errors }) => {
  await page.goto(ui.url);
  await page.locator('button[data-action="create-session"][data-target="fixture"]').click();
  const dialog = page.locator('#management-dialog[data-kind="create"]');
  await dialog.locator("#confirm-create-session").waitFor();
  await dialog.locator("#create-session-label").fill("Created in page");
  await settle();
  const created = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/sessions" && response.request().method() === "POST");
  const mark = requests.mark();
  await dialog.locator("#confirm-create-session").click();
  const response = await created;
  const { session } = await response.json();
  await page.waitForFunction(() => document.querySelector("#chat-thinking-select")?.disabled === false);
  await settle();
  // Session reads only: per-session panels (monitor, extension UI) request their own resources either way.
  const after = requests.list(mark).filter((entry) => /^GET \/api\/(workbench|session-control|sessions\/[^/]+(\/events|\/native)?)$/.test(entry));
  console.log(`REQTRIM create-session ${JSON.stringify({ count: after.length, after })}`);
  const path = `/api/sessions/${encodeURIComponent(session.sessionId)}`;
  assert.deepEqual(after.sort(), [`GET ${path}/events`, `GET ${path}/native`].sort());
  assert.deepEqual(errors, []);
  console.log("PASS request trim: session creation uses the POST result");
});

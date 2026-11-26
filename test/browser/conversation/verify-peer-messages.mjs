import assert from "node:assert/strict";

const summary = Array.from({ length: 8 }, (_, index) => `- Result line ${index + 1}`).join("\n");
const update = Array.from({ length: 8 }, (_, index) => `Progress line ${index + 1}`).join("\n\n");

/** A child's failure notice (already delivered), plain update and result render compact in the parent's transcript. */
export async function verifyPeerMessages(f, parent, child) {
  for (const call of [
    { name: "session_send", args: { to: parent, message: update } },
    { name: "session_result", args: { summary, artifacts: ["notes/result.md"] } },
  ]) assert.equal((await f.complete(child, await f.send(child, `TOOL ${JSON.stringify(call)}`))).status, "completed", call.name);
  await f.open(parent);
  const rows = f.page.locator(".pi-message-peer");
  const result = rows.filter({ has: f.page.locator('[data-peer-report="result"]') });
  await result.getByText("Result line 1").waitFor();
  await rows.locator('[data-peer-report="failure"]').first().waitFor();
  const plain = rows.filter({ hasText: "Progress line 1" });
  await plain.locator(".pi-message-fold[data-folded]").waitFor();
  assert(await plain.locator(".pi-message-fold").evaluate((node) => node.clientHeight < 100), "peer preview stays a few lines high");

  const fold = result.locator(".pi-message-fold");
  await fold.and(f.page.locator("[data-folded]")).waitFor();
  assert.equal(await result.locator(".pi-peer-artifacts").count(), 0, "artifacts wait for expansion");
  await result.locator('[data-action="toggle-message-fold"]').click();
  await result.locator('[data-action="toggle-message-fold"][aria-expanded="true"]').waitFor();
  await result.locator(".pi-peer-artifacts").getByText("notes/result.md").waitFor();
  assert.equal(await fold.getAttribute("data-folded"), null);

  const shown = await f.page.locator("#messages").innerText();
  for (const raw of ["[派生会话", "session_send", "No reply expected", "\"summary\""]) assert(!shown.includes(raw), `protocol text ${raw} is not displayed`);
}

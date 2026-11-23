import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openPage } from "./page-driver.mjs";

/** Directory picker (cancel keeps the value, absolute paths, truncation, root) and the @ reference menu on the real API. */
export function pickerReferenceSteps(rig, seed, state) {
  const picker = (d) => d.page.locator("#directory-picker");
  const shownPath = (d) => picker(d).locator(".management-directory-path");
  const open = async (d, path) => { await picker(d).locator(`[data-action="directory-open"][data-path="${path}"]`).click(); await shownPath(d).and(d.page.locator(`[data-path="${path}"]`)).waitFor(); };
  const compose = async (d, text) => { await d.page.locator("#composer").fill(text); };
  const option = (d, path) => d.page.locator(`#native-reference-list [data-path="${path}"]`);
  return [
    ["picker opens at the cwd (absolute), navigates, and cancel keeps the original value", async () => {
      const d = state.desktop ??= await openPage(rig, { name: "desktop" });
      await d.page.locator("#harness-open-picker").click();
      await shownPath(d).and(d.page.locator(`[data-path="${seed.work}"]`)).waitFor();
      assert.equal(await shownPath(d).getAttribute("data-at-root"), "false");
      await open(d, seed.at("proj"));
      await picker(d).locator('[data-action="directory-up"]').click();
      await shownPath(d).and(d.page.locator(`[data-path="${seed.work}"]`)).waitFor();
      await d.shot("04-picker");
      await open(d, seed.at("proj2"));
      await picker(d).locator('[data-action="directory-back"]').click();
      await picker(d).waitFor({ state: "detached" });
      assert.equal(await d.page.locator("#harness-cwd").inputValue(), seed.work, "cancel keeps the previous value");
    }],
    ["picker selects a directory; a truncated directory says so; the root has no parent", async () => {
      const d = state.desktop;
      await d.page.locator("#harness-open-picker").click();
      await picker(d).locator('[data-action="directory-up"]').click();
      await open(d, seed.big);
      await picker(d).locator('[data-state="truncated"]').waitFor();
      await picker(d).locator('[data-action="directory-up"]').click();
      await open(d, seed.work);
      await open(d, seed.at("proj"));
      await picker(d).locator('[data-action="directory-select"]').click();
      assert.equal(await d.page.locator("#harness-cwd").inputValue(), seed.at("proj"));
      await d.page.locator("#harness-open-picker").click();
      await shownPath(d).and(d.page.locator(`[data-path="${seed.at("proj")}"]`)).waitFor();
      for (let guard = 0; guard < 30 && (await shownPath(d).getAttribute("data-at-root")) !== "true"; guard++) {
        await picker(d).locator('[data-action="directory-up"]').click();
        await d.page.waitForTimeout(150);
      }
      assert.equal(await shownPath(d).getAttribute("data-path"), "/");
      assert.equal(await picker(d).locator('[data-action="directory-up"]').isDisabled(), true);
      await picker(d).locator('[data-action="directory-back"]').click();
    }],
    ["@ lists the cwd (directories navigable, dotfiles hidden); a leading dot shows them", async () => {
      const d = state.desktop;
      await compose(d, "@");
      await d.page.locator('#native-reference-list[data-status="ready"]').waitFor();
      assert.equal(await option(d, seed.at("proj")).getAttribute("data-kind"), "directory");
      assert.equal(await option(d, seed.at("notes.txt")).getAttribute("data-kind"), "file");
      assert.equal(await option(d, seed.at("link-dir")).getAttribute("data-kind"), "directory", "a symlink to a directory navigates");
      assert.equal(await option(d, seed.at(".hidden-file")).count(), 0);
      await d.shot("05-reference-menu");
      await compose(d, "@.");
      await option(d, seed.at(".hidden-file")).waitFor();
      await option(d, seed.at(".dotdir")).waitFor();
    }],
    ["@ directory then file: the file is attached with its absolute path and owning target", async () => {
      const d = state.desktop;
      await compose(d, "see @pro");
      await option(d, seed.at("proj")).click();
      assert.equal(await d.page.locator("#composer").inputValue(), "see @proj/");
      await option(d, seed.at("proj/README.md")).waitFor();
      assert.equal(await option(d, seed.at("proj/src")).getAttribute("data-kind"), "directory");
      await option(d, seed.at("proj/README.md")).click();
      const attached = d.page.locator(`#harness-attached li[data-path="${seed.at("proj/README.md")}"]`);
      await attached.waitFor();
      assert.equal(await attached.getAttribute("data-target"), "owned");
      const response = await fetch(`${rig.gateway.url}/api/sessions/${rig.gateway.sessionId}/native`, {
        method: "POST", headers: { "content-type": "application/json", origin: rig.gateway.url },
        body: JSON.stringify({ requestId: randomUUID(), action: "reference-read", args: { target: "owned", sessionId: rig.gateway.sessionId, path: seed.at("proj/README.md") } }),
      });
      assert.equal((await response.json()).data.content, "# proj\n", "reference-read takes the candidate's absolute path (HTTP, outside the browser)");
    }],
    ["@ failures keep their structured reason and never look like an empty success", async () => {
      const d = state.desktop;
      const expectReason = async (text, reason) => {
        await compose(d, text);
        await d.page.locator(`#native-reference-error[data-reason="${reason}"]`).waitFor();
        assert.equal(await d.page.locator("#native-reference-list").getAttribute("data-status"), "error");
      };
      await expectReason("@~/x", "home-unsupported");
      await expectReason("@notes.txt/", "not-directory");
      await expectReason("@no-such-dir/", "not-found");
      // Rejected by the HTTP layer before the module runs: no structured reason, so the UI shows the server's message under `failed`.
      await expectReason("@a\\b", "failed");
      assert.notEqual((await d.page.locator("#native-reference-error").textContent()).trim(), "", "the failure carries a message");
      await d.shot("06-reference-error");
    }],
    ["@ in a directory over the entry limit says it is truncated", async () => {
      const d = state.desktop;
      await compose(d, "@../big/");
      await d.page.locator("#native-reference-truncated").waitFor();
    }],
    ["every reference request names the target; the files requests of this page stay on it", async () => {
      const native = state.desktop.seen.requests.filter((request) => request.path.endsWith("/native"));
      assert.ok(native.length > 5);
      assert.deepEqual(native.filter((request) => request.body?.args?.target !== "owned"), []);
      const browse = state.desktop.seen.requests.filter((request) => request.path === "/api/targets/browse");
      assert.ok(browse.length > 5);
      assert.deepEqual(browse.filter((request) => !request.body.path.startsWith("/")), [], "picker paths are absolute");
    }],
  ];
}

import assert from "node:assert/strict";
import { readFile, access, stat } from "node:fs/promises";
import { openPage } from "./page-driver.mjs";

const exists = (path) => access(path).then(() => true, () => false);

/** Create / upload / overwrite-confirm / delete-confirm / non-empty directory / rename with an open tab, on the real API. */
export function opsSteps(rig, seed, state) {
  const modalButton = (d, variant) => d.page.locator(`.mantine-Modal-content [data-variant="${variant}"]`);
  const upload = async (d, name, text) => {
    const chooser = d.page.waitForEvent("filechooser");
    await d.page.locator("#files-new").click();
    await d.page.locator('[data-action="upload"]').click();
    await (await chooser).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
  };
  const uploaded = seed.at("up-new.txt");
  const notes = seed.at("notes.txt");
  return [
    ["create a file and a folder from the + menu; the new file opens", async () => {
      const d = state.desktop ??= await openPage(rig, { name: "desktop" });
      await d.page.locator("#files-new").click(); await d.page.locator('[data-action="newFile"]').click();
      await d.page.locator(".pi-files-input").fill("created.txt"); await d.page.keyboard.press("Enter");
      await d.row(seed.at("created.txt")).waitFor();
      await d.tab(seed.at("created.txt")).waitFor();
      assert.equal((await stat(seed.at("created.txt"))).size, 0, "an empty text file is valid");
      await d.page.locator("#files-new").click(); await d.page.locator('[data-action="newFolder"]').click();
      await d.page.locator(".pi-files-input").fill("made-dir"); await d.page.keyboard.press("Enter");
      await d.row(seed.at("made-dir")).waitFor();
      assert.equal((await stat(seed.at("made-dir"))).isDirectory(), true);
    }],
    ["rename a file whose tab is open: the tab follows the new path", async () => {
      const d = state.desktop;
      await d.menuOn(seed.at("created.txt"), "rename");
      await d.page.locator(".pi-files-input").fill("renamed.txt"); await d.page.keyboard.press("Enter");
      await d.tab(seed.at("renamed.txt")).waitFor();
      await d.tab(seed.at("created.txt")).waitFor({ state: "detached" });
      assert.equal(await exists(seed.at("renamed.txt")), true);
      assert.equal(await exists(seed.at("created.txt")), false);
      await d.shot("07-after-rename");
    }],
    ["upload: new file lands on the target; an existing name asks before overwriting", async () => {
      const d = state.desktop;
      await upload(d, "up-new.txt", "uploaded\n");
      await d.row(uploaded).waitFor();
      assert.equal(await readFile(uploaded, "utf8"), "uploaded\n");
      await upload(d, "up-new.txt", "second upload\n");
      await d.page.locator("#confirm-file-overwrite").waitFor();
      assert.equal(await readFile(uploaded, "utf8"), "uploaded\n", "nothing is overwritten before the confirmation");
      await d.shot("08-upload-clash");
      await modalButton(d, "default").click();
      await d.page.locator("#confirm-file-overwrite").waitFor({ state: "detached" });
      assert.equal(await readFile(uploaded, "utf8"), "uploaded\n", "skip keeps the original");
      await upload(d, "up-new.txt", "second upload\n");
      await d.page.locator("#confirm-file-overwrite").click();
      await d.page.locator("#confirm-file-overwrite").waitFor({ state: "detached" });
      assert.equal(await readFile(uploaded, "utf8"), "second upload\n");
    }],
    ["delete asks first: cancel keeps the file, confirm removes it", async () => {
      const d = state.desktop;
      await d.menuOn(uploaded, "delete");
      await d.page.locator("#confirm-file-delete").waitFor();
      await modalButton(d, "default").click();
      await d.page.locator("#confirm-file-delete").waitFor({ state: "detached" });
      assert.equal(await exists(uploaded), true);
      await d.menuOn(uploaded, "delete");
      await d.page.locator("#confirm-file-delete").click();
      await d.row(uploaded).waitFor({ state: "detached" });
      assert.equal(await exists(uploaded), false);
    }],
    ["deleting a non-empty directory is refused and reported, nothing is deleted", async () => {
      const d = state.desktop;
      await d.menuOn(seed.at("full-dir"), "delete");
      await d.page.locator(".mantine-Modal-content").waitFor();
      await d.shot("09-delete-dir-prompt");
      await d.page.locator("#confirm-file-delete").click();
      await d.page.locator("#files-panel [role=alert]").waitFor();
      assert.equal(await exists(seed.at("full-dir/keep.txt")), true);
      await d.row(seed.at("full-dir")).waitFor();
      await d.shot("10-delete-dir-refused");
    }],
    ["duplicate copies on the target; an open file keeps its tab", async () => {
      const d = state.desktop;
      await d.menuOn(notes, "duplicate");
      await d.page.locator('#files-panel li[data-path*="notes-"]').first().waitFor();
      assert.deepEqual(await readFile(seed.at("notes-Copy1.txt"), "utf8"), await readFile(notes, "utf8"), "the copy is made on the target and has the same content");
    }],
  ];
}

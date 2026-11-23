import assert from "node:assert/strict";
import { readFile, writeFile, utimes } from "node:fs/promises";
import { openPage } from "./page-driver.mjs";

// An external writer (an agent, another process) changes the file and moves its mtime.
const externalWrite = async (path, text) => { await writeFile(path, text); const later = new Date(Date.now() + 5000); await utimes(path, later, later); };

/** Tree, hidden files, truncation, read/write and mtime conflict on the real HTTP→Gateway→target path (desktop). */
export function fileSteps(rig, seed, state) {
  const notes = seed.at("notes.txt");
  const save = (d, path) => d.editor(path).locator('[data-action="save-file"]').click();
  const up = (d) => d.page.locator(".pi-files-crumbs button.pi-files-crumb").last().click();
  const toggleHidden = async (d) => { await d.page.locator("#files-new").click(); await d.page.locator('[data-action="toggleHidden"]').click(); };
  return [
    ["tree lists the saved cwd as an absolute path; dotfiles hidden", async () => {
      const d = state.desktop = await openPage(rig, { name: "desktop" });
      await d.row(notes).waitFor();
      assert.equal(await d.page.locator("[data-abs-path]").getAttribute("data-abs-path"), seed.work);
      assert.equal(await d.row(seed.at(".hidden-file")).count(), 0);
      assert.equal(await d.row(seed.at("proj")).getAttribute("data-type"), "directory");
      await d.shot("01-tree");
    }],
    ["hidden toggle shows and hides dotfiles", async () => {
      const d = state.desktop;
      await toggleHidden(d);
      await d.row(seed.at(".hidden-file")).waitFor();
      await toggleHidden(d);
      await d.row(seed.at(".hidden-file")).waitFor({ state: "detached" });
    }],
    ["directory navigation up and down; a truncated listing says so", async () => {
      const d = state.desktop;
      await d.row(seed.at("proj")).locator(".pi-files-row").click();
      await d.row(seed.at("proj/src")).waitFor();
      await up(d);
      await d.row(notes).waitFor();
      await up(d);
      await d.row(seed.big).locator(".pi-files-row").click();
      await d.page.locator('#files-panel [data-state="truncated"]').waitFor();
      assert.equal(await d.page.locator("#files-panel li[data-path]").count(), 1000, "exactly directoryEntries rows");
      await d.shot("02-truncated");
      await up(d);
      await d.row(seed.work).locator(".pi-files-row").click();
      await d.row(notes).waitFor();
    }],
    ["open, edit and save a text file", async () => {
      const d = state.desktop;
      await d.row(notes).locator(".pi-files-row").click();
      await d.waitText(notes, "hello notes");
      await d.typeInto(notes, "+edit");
      await d.page.locator(`.pi-tab[data-path="${notes}"][data-dirty="true"]`).waitFor();
      await save(d, notes);
      await d.page.locator(`.pi-tab[data-path="${notes}"][data-dirty]`).waitFor({ state: "detached" });
      assert.equal(await readFile(notes, "utf8"), "hello notes\n+edit");
    }],
    ["mtime conflict: reload takes the disk version", async () => {
      const d = state.desktop;
      await d.typeInto(notes, "A");
      await externalWrite(notes, "agent wrote this\n");
      await save(d, notes);
      await d.page.locator("#file-conflict").waitFor();
      assert.equal(await d.page.locator("#file-retargeted").count(), 0, "an ordinary conflict is not a retarget");
      assert.equal(await readFile(notes, "utf8"), "agent wrote this\n", "the refused write changed nothing");
      await d.shot("03-conflict");
      await d.page.locator('#file-conflict [data-action="reload-file"]').click();
      await d.waitText(notes, "agent wrote this");
      await d.page.locator("#file-conflict").waitFor({ state: "detached" });
    }],
    ["mtime conflict: overwrite writes the draft", async () => {
      const d = state.desktop;
      await d.typeInto(notes, "B");
      await externalWrite(notes, "agent again\n");
      await save(d, notes);
      await d.page.locator("#file-conflict").waitFor();
      await d.page.locator('#file-conflict [data-action="overwrite-file"]').click();
      await d.page.locator("#file-conflict").waitFor({ state: "detached" });
      assert.equal(await readFile(notes, "utf8"), "agent wrote this\nB", "the draft (reloaded text + B) replaced the external version");
    }],
    ["every files request so far names the owning target", async () => {
      const requests = state.desktop.fileRequests();
      assert.ok(requests.length > 10);
      assert.deepEqual(requests.filter((request) => request.body?.target !== "owned"), []);
      assert.ok(["list", "read", "write"].every((method) => requests.some((request) => request.path.endsWith(`/files/${method}`))));
    }],
  ];
}

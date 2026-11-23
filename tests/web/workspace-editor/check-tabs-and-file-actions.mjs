// ── editor: open / focus / split / close / dirty / save / conflict ──
// ── tabs follow renames and deletes made in the tree ──
import assert from "node:assert/strict";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";

export async function checkTabsAndFileActions(ctx) {
await ctx.step("editor tabs, split, dirty close, save and conflict", async () => {
    const h = await ctx.open({ storage: ctx.OPEN });
    const { page, fs } = h;
    assert.equal(await ctx.tabs(page), 0, "nothing open: empty state");
    // Closing the only workspace tab removes its group; the next file creates a new group beside the chat.
    await ctx.openFile(page, "notes.txt");
    assert.equal(await ctx.groups(page), 2, "the first file adds a workspace group beside the chat");
    await ctx.tab(page, "notes.txt").locator('[data-action="close-tab"]').click();
    assert.equal(await ctx.groups(page), 1, "the chat group remains after the last workspace tab closes");
    await ctx.openFile(page, "main.py");
    assert.equal(await ctx.groups(page), 2, "a new tab creates one workspace group, not another chat group");
    await ctx.tab(page, "main.py").locator('[data-action="close-tab"]').click();
    assert.equal(await ctx.groups(page), 1, "closing the last workspace tab leaves the chat alone");
    await ctx.openFile(page, "main.py");
    await ctx.openFile(page, "README.md");
    await ctx.row(page, "main.py").click();
    assert.equal(await ctx.tabs(page), 2, "opening an open file focuses it, no duplicate tab");
    assert.equal(await page.locator('.dv-tab.dv-active-tab .pi-tab[data-path="main.py"]').count(), 1, "and it is the active tab");
    assert.equal(await ctx.row(page, "main.py").evaluate((node) => node.classList.contains("is-active")), true, "the tree marks the active file");

    // markdown preview <-> source
    await ctx.tab(page, "README.md").click();
    await ctx.body(page, "README.md").locator(".pi-markdown").waitFor();
    await ctx.body(page, "README.md").locator('[role="radio"], input[type="radio"]').last().evaluate((node) => node.click());
    await ctx.editor(page, "README.md");

    // unsaved text survives a drag into a new group
    await ctx.tab(page, "main.py").click();
    await ctx.type(page, "main.py", "# edit");
    await ctx.tab(page, "main.py").locator(".pi-file-dirty").waitFor();
    assert.equal(await ctx.groups(page), 2);
    await ctx.dragToRightEdge(page, "main.py");
    assert.equal(await ctx.groups(page), 3, "dragging to the workspace edge adds a second workspace group");
    assert.equal(await ctx.tabs(page), 2);
    assert.match(await (await ctx.editor(page, "main.py")).textContent(), /# edit/, "unsaved text survived the move");
    assert.equal(await ctx.tab(page, "main.py").getAttribute("data-dirty"), "true");
    await assertUniqueIds(page, "split");

    // closing a dirty tab asks first
    await ctx.tab(page, "main.py").locator('[data-action="close-tab"]').click();
    await page.locator("#confirm-close-discard").waitFor();
    await page.locator('.mantine-Modal-content [data-action="cancel"]').click();
    await page.locator("#confirm-close-discard").waitFor({ state: "hidden" });
    assert.equal(await ctx.tabs(page), 2, "cancel keeps the tab");
    // save: Ctrl+S writes with the mtime guard, then closing needs no confirmation
    await (await ctx.editor(page, "main.py")).click();
    await page.keyboard.press("Control+s");
    await page.waitForFunction(() => !document.querySelector('.pi-tab[data-path="main.py"][data-dirty]'));
    assert.deepEqual(fs.writes, ["main.py"]);
    assert.equal(fs.files.get("main.py").content, "print('hi')\n# edit");
    // someone else changes the file: the next save is refused and offers reload / overwrite
    fs.external("main.py", "agent was here");
    await ctx.type(page, "main.py", "!");
    await page.keyboard.press("Control+s");
    await page.locator("#file-conflict").waitFor();
    assert.equal(fs.files.get("main.py").content, "agent was here", "a conflicting save wrote nothing");
    await page.locator('#file-conflict [data-action="overwrite-file"]').click();
    await page.waitForFunction(() => !document.querySelector("#file-conflict"));
    assert.match(fs.files.get("main.py").content, /!$/, "overwrite wrote our text");
    fs.external("main.py", "agent again");
    await ctx.type(page, "main.py", "?");
    await page.keyboard.press("Control+s");
    await page.locator('#file-conflict [data-action="reload-file"]').click();
    await page.waitForFunction(() => document.querySelector('.pi-file[data-path="main.py"] .cm-content')?.textContent === "agent again");
    assert.equal(await ctx.tab(page, "main.py").getAttribute("data-dirty"), null, "reloading takes the disk text and clears the dirty mark");
    // discard path: dirty again, close, confirm, reopen reads the disk text
    await ctx.type(page, "main.py", "zzz");
    await ctx.tab(page, "main.py").locator('[data-action="close-tab"]').click();
    await page.locator("#confirm-close-discard").click();
    await ctx.tab(page, "main.py").waitFor({ state: "detached" });
    assert.equal(await ctx.groups(page), 2, "closing the only tab of a workspace group removes that group, not the chat");
    await ctx.openFile(page, "main.py");
    assert.equal(await ctx.tab(page, "main.py").getAttribute("data-dirty"), null);
    assert.equal(await (await ctx.editor(page, "main.py")).textContent(), "agent again", "discarded text is gone");
    await ctx.finish(h, "editor");
  });

await ctx.step("tree rename and delete reach the tabs", async () => {
    const h = await ctx.open({ storage: ctx.OPEN });
    const { page, fs } = h;
    await ctx.openFile(page, "notes.txt"); await ctx.openFile(page, "main.py");
    await ctx.tab(page, "notes.txt").click();
    await ctx.type(page, "notes.txt", "+");
    await ctx.row(page, "notes.txt").click({ button: "right" });
    await page.locator('.pi-files-menu [data-action="rename"]').click();
    await page.locator(".pi-files-input").fill("renamed.txt");
    await page.keyboard.press("Enter");
    await ctx.tab(page, "renamed.txt").waitFor();
    assert.equal(await ctx.tab(page, "notes.txt").count(), 0);
    assert.equal(await ctx.tab(page, "renamed.txt").getAttribute("data-dirty"), "true", "unsaved text followed the rename");
    assert.ok(fs.files.has("renamed.txt"));
    await ctx.row(page, "main.py").click({ button: "right" });
    await page.locator('.pi-files-menu [data-action="delete"]').click();
    await page.locator("#confirm-file-delete").click();
    await ctx.tab(page, "main.py").waitFor({ state: "detached" });
    assert.equal(await ctx.tabs(page), 1, "deleting a file closes its tab");
    await ctx.finish(h, "rename/delete");
  });
}

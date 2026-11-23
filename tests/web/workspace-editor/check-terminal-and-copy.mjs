// ── shell tabs: one tab strip, each shell its own live xterm that survives tab switches and splits; a new shell and ending one ──
// ── terminal socket: keys leave at once, a dropped socket reconnects into the same xterm, a final close does not ──
// ── editor syntax colours come from the theme variables, not CodeMirror's built-in palette ──
import assert from "node:assert/strict";
import { openMockWorkbench } from "../../fixtures/workspace-mock.mjs";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { createMockFs } from "../../fixtures/workspace-mock/create-mock-fs.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";

export async function checkTerminalAndCopy(ctx) {
await ctx.step("shell tabs: one strip, several live terminals, split across the dock", async () => {
    const h = await ctx.open({ storage: { "pi.layout.workspaceOpen": "true" }, terminals: [] });
    const { page, sockets } = h;
    const shellTab = (name) => page.locator(`.pi-tab[data-shell="${name}"]`);
    const xterm = (name) => page.locator(`#desktop-stage .pi-term[data-shell="${name}"] .xterm`);
    // Drop a shell's tab on an edge of the group holding `target`: dockview splits a new group off beside / below it. The
    // tab being dragged may be a background one (its group shows another shell's overlay): that is the case that needs
    // the drag passthrough, so the overlays are given time to settle first.
    const dragTab = async (name, target, edge) => {
      await page.waitForTimeout(500);
      const group = await page.locator(".dv-groupview", { has: page.locator(target) }).boundingBox();
      const box = await shellTab(name).boundingBox();
      await page.mouse.move(box.x + 20, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 40, box.y + 60, { steps: 4 });
      await page.mouse.move(group.x + (edge === "right" ? group.width - 30 : group.width / 2), group.y + (edge === "bottom" ? group.height - 30 : group.height / 2), { steps: 12 });
      await page.waitForTimeout(150);
      await page.mouse.up();
      await page.waitForTimeout(300);
    };
    // an empty workspace lands in a terminal by itself: one shell tab, the only tab strip, nothing else around it
    await xterm("shell").waitFor({ state: "visible" });
    assert.equal(await page.locator('#desktop-stage .pi-tab[data-kind="terminal"]').count(), 1);
    assert.equal(await page.locator(".pi-term-bar, .pi-term-tabs, .pi-rail, #terminal-drawer").count(), 0, "no second tab row, no rail");
    assert.equal(await page.locator(".pi-stage-strip #toggle-tree").count(), 1, "the tree toggle is in the stage strip");
    assert.equal(await page.locator("#file-tree").isVisible(), false, "a workspace with a terminal does not open the tree");
    assert.equal(sockets.length, 1);
    await xterm("shell").evaluate((node) => { node.dataset.mark = "one"; });
    await page.locator("#toggle-tree").click();
    await ctx.openFile(page, "main.py");
    assert.equal(await ctx.groups(page), 2, "a file joins the shell's workspace group beside chat");
    await page.locator("#new-terminal").click();
    await xterm("shell-2").waitFor({ state: "visible" });
    await xterm("shell-2").evaluate((node) => { node.dataset.mark = "two"; });
    assert.equal(await page.locator(".dv-tabs-container .dv-tab:has(.pi-tab)").count(), 3, "file + two shells in one workspace strip");
    assert.equal(sockets.length, 2, "the new shell attached its own socket");
    for (let round = 0; round < 2; round += 1) {
      await ctx.tab(page, "main.py").click();
      await xterm("shell-2").waitFor({ state: "hidden" });
      assert.equal(await page.locator(".pi-term .xterm").count(), 2, "hidden behind a file tab, both xterms are still mounted");
      await shellTab("shell").click();
      await xterm("shell").waitFor({ state: "visible" });
    }
    assert.deepEqual([await xterm("shell").getAttribute("data-mark"), await xterm("shell-2").getAttribute("data-mark"), sockets.length], ["one", "two", 2], "switching tabs rebuilds and reconnects nothing");
    // split: shell-2 below the other tabs, so two live terminals are on screen at once
    await dragTab("shell-2", '.pi-tab[data-shell="shell"]', "bottom");
    assert.equal(await ctx.groups(page), 3, "chat and two vertically split workspace groups");
    await xterm("shell").waitFor({ state: "visible" });
    await xterm("shell-2").waitFor({ state: "visible" });
    assert.ok((await shellTab("shell-2").boundingBox()).y > (await shellTab("shell").boundingBox()).y + 100, "shell-2's group is below");
    await page.locator("#toggle-tree").click(); // the popover closed when main.py opened
    await ctx.openFile(page, "README.md");
    assert.ok((await ctx.tab(page, "README.md").boundingBox()).y < (await shellTab("shell-2").boundingBox()).y, "a file opened from the tree lands in the file group, not the shell's");
    await dragTab("shell-2", '.pi-tab[data-shell="shell"]', "right");
    assert.equal(await ctx.groups(page), 3, "chat and two horizontally split workspace groups");
    assert.ok((await shellTab("shell-2").boundingBox()).x > (await shellTab("shell").boundingBox()).x + 100, "shell-2's column is beside");
    assert.deepEqual([await xterm("shell").getAttribute("data-mark"), await xterm("shell-2").getAttribute("data-mark"), sockets.length], ["one", "two", 2], "splitting rebuilds and reconnects nothing");
    for (const socket of sockets) {
      const sizes = socket.received.filter((frame) => frame.type === "resize");
      assert.ok(sizes.length > 0 && sizes.every((frame) => frame.rows > 1 && frame.cols > 1), `through all of it a terminal only reports real sizes (${JSON.stringify(sizes)})`);
    }
    await assertUniqueIds(page, "shells");
    // the layout survives a reload: both shells, the split, the file
    await page.reload(); await selectSession(page, "w1");
    await xterm("shell-2").waitFor({ state: "visible" });
    assert.deepEqual([await ctx.groups(page), await page.locator('#desktop-stage .pi-tab[data-kind="terminal"]').count(), await ctx.tab(page, "main.py").count()], [3, 2, 1], "reload: chat, the workspace split, both shells and the file come back");
    // ending a shell asks first; cancel keeps it, confirm ends it on the server and closes its tab
    await shellTab("shell-2").hover();
    await shellTab("shell-2").locator('[data-action="close-tab"]').click();
    await page.locator("#confirm-end-terminal").waitFor();
    await page.locator('#end-terminal-dialog [data-action="cancel"]').click();
    await page.locator("#confirm-end-terminal").waitFor({ state: "hidden" });
    assert.equal(await shellTab("shell-2").count(), 1, "cancel keeps the shell");
    await shellTab("shell-2").hover();
    await shellTab("shell-2").locator('[data-action="close-tab"]').click();
    await page.locator("#confirm-end-terminal").click();
    await shellTab("shell-2").waitFor({ state: "detached" });
    await page.waitForFunction(() => document.querySelectorAll(".pi-term .xterm").length === 1);
    assert.equal(await shellTab("shell").count(), 1, "the other shell is untouched");
    await ctx.finish(h, "shell tabs");
  });

await ctx.step("terminal socket: instant input, reconnect with replay, final close stays closed", async () => {
    const h = await ctx.open({ storage: ctx.OPEN, terminals: [] });
    const { page, sockets } = h;
    // (the pinned tree holds the empty workspace open; the sync opens the first shell on its own)
    await page.locator('.pi-term .pi-term-view[data-status="connected"]').waitFor();
    assert.equal(sockets.length, 1, "one socket per terminal");
    await page.locator(".pi-term .xterm").evaluate((node) => { node.dataset.mark = "kept"; });
    const sent = (socket) => socket.received.filter((frame) => frame.type === "input").map((frame) => frame.data).join("");
    const rows = () => page.locator(".pi-term .xterm-rows").evaluate((node) => node.textContent);
    const until = async (predicate, label) => {
      for (let attempt = 0; attempt < 200; attempt += 1) { if (await predicate()) return; await page.waitForTimeout(25); }
      throw new Error(`Timed out: ${label}`);
    };
    await page.locator(".pi-term textarea.xterm-helper-textarea").focus();
    const typed = "abcdefghijklmnopqrstuvwxyz0123";
    await page.keyboard.type(typed);
    await until(() => sent(sockets[0]) === typed, "every key reached the socket in order");
    assert.equal(sockets[0].received.filter((frame) => frame.type === "input").length, typed.length, "one frame per key, no batching timer");
    sockets[0].send({ type: "stdout", data: "FIRST_OUTPUT\r\n" });
    await until(async () => (await rows()).includes("FIRST_OUTPUT"), "output shows");

    sockets[0].close();
    await until(() => sockets.length === 2, "the dropped socket reconnects");
    await page.locator('.pi-term .pi-term-view[data-status="connected"]').waitFor();
    await until(async () => !(await rows()).includes("FIRST_OUTPUT"), "the screen is rebuilt from the new replay, not appended to");
    assert.equal(await page.locator(".pi-term .xterm").getAttribute("data-mark"), "kept", "xterm is not rebuilt by a reconnect");
    assert.equal(await page.locator(".pi-term .xterm").count(), 1);
    await page.keyboard.type("z");
    await until(() => sent(sockets[1]) === "z", "input goes to the new socket");
    assert.equal(sent(sockets[0]), typed, "and not to the dropped one");

    sockets[1].close(4000);
    await page.locator('.pi-term .pi-term-view[data-status="failed"]').waitFor();
    await page.waitForTimeout(900);
    assert.equal(sockets.length, 2, "a final close is not retried");
    assert.equal(await page.locator(".pi-term .xterm").getAttribute("data-mark"), "kept");
    await ctx.finish(h, "terminal socket");
  });

await ctx.step("terminal menu: PRK right-click menu, clipboard keys, mouse-reporting programs keep the right click", async () => {
    const h = await ctx.open({ storage: ctx.OPEN, terminals: [], terminalReplay: "COPY_ME_123\r\n" });
    const { page, context, sockets } = h;
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ctx.server.url });
    await page.locator('.pi-term .pi-term-view[data-status="connected"]').waitFor();
    const menu = page.locator('.pi-term-menu[data-shell="shell"]');
    const item = (action) => menu.locator(`[data-action="${action}"]`);
    const word = page.locator(".pi-term .xterm-rows > div").first();
    const inputs = () => sockets[0].received.filter((frame) => frame.type === "input").length;
    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    const copied = async (want, label) => {
      for (let attempt = 0; attempt < 100; attempt += 1) { if (want.test(await clipboard())) return; await page.waitForTimeout(25); }
      assert.match(await clipboard(), want, label);
    };
    const rightClick = async (modifiers = []) => {
      const box = await page.locator(".pi-term .xterm-screen").boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (const key of modifiers) await page.keyboard.down(key);
      await page.mouse.down({ button: "right" }); await page.mouse.up({ button: "right" });
      for (const key of modifiers) await page.keyboard.up(key);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    // every contextmenu inside the terminal is cancelled, so the browser's own menu never shows
    await page.evaluate(() => { window.__menus = []; window.addEventListener("contextmenu", (event) => window.__menus.push(event.defaultPrevented)); });
    await page.waitForFunction(() => document.querySelector(".pi-term .xterm-rows")?.textContent.includes("COPY_ME_123"));
    await page.evaluate(() => navigator.clipboard.writeText("before"));
    const at = await rightClick();
    await menu.waitFor();
    const box = await menu.boundingBox();
    assert.ok(Math.abs(box.x - at.x) < 12 && Math.abs(box.y - at.y) < 12, "the menu opens at the pointer");
    assert.deepEqual(await menu.locator("[data-action]").evaluateAll((nodes) => nodes.map((node) => [node.dataset.action, node.querySelector(".pi-term-menu-keys")?.textContent])),
      [["copy", "Ctrl+Shift+C"], ["paste", "Ctrl+Shift+V"], ["select-all", "Ctrl+Shift+A"]], "copy, paste, select all with their keys");
    assert.equal(await menu.locator(".mantine-Menu-divider").count(), 1);
    assert.equal(await item("copy").isDisabled(), true, "nothing selected: copy is disabled");
    assert.equal(await item("paste").isDisabled(), false, "a secure page (localhost) may read the clipboard");
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    // a selection: the menu's copy and Ctrl+Shift+C both reach the clipboard, and neither sends input
    const sentBefore = inputs();
    const row = await word.boundingBox();
    await page.mouse.dblclick(row.x + 20, row.y + row.height / 2);
    await rightClick();
    await item("copy").click();
    await menu.waitFor({ state: "detached" });
    await copied(/^COPY_ME_123$/, "menu copy");
    await page.evaluate(() => navigator.clipboard.writeText("before"));
    await page.keyboard.press("Control+Shift+C");
    await copied(/^COPY_ME_123$/, "Ctrl+Shift+C");
    await page.keyboard.press("Control+Shift+A");
    await page.keyboard.press("Control+Shift+C");
    await copied(/^COPY_ME_123\n/, "Ctrl+Shift+A selected the whole screen");
    assert.equal(inputs(), sentBefore, "menu copy, Ctrl+Shift+C and Ctrl+Shift+A send nothing to the PTY");
    // a program that reports the mouse (vim, tmux, htop) gets the plain right click; Shift+right click still opens the menu
    sockets[0].send({ type: "stdout", data: "\x1b[?1000h\x1b[?1006h" }); // button reports, SGR encoding (vim, tmux)
    await page.waitForTimeout(100);
    await rightClick();
    await page.waitForTimeout(200);
    assert.equal(await menu.count(), 0, "mouse reporting: no menu on a plain right click");
    assert.ok(sockets[0].received.some((frame) => frame.type === "input" && frame.data.startsWith("\x1b[<2;")), "the right click went to the program");
    await rightClick(["Shift"]);
    await menu.waitFor();
    assert.deepEqual(await page.evaluate(() => window.__menus), [true, true, true, true], "four right clicks, the browser menu suppressed every time");
    await ctx.finish(h, "terminal menu");
  });

await ctx.step("editor highlighting uses --pi-syn-*", async () => {
    const colours = {};
    let h;
    for (const scheme of ["light", "dark"]) {
      if (!h) {
        h = await openMockWorkbench(ctx.browser, ctx.server.url, { fs: createMockFs({ "x.py": "def f():\n    return 'text'  # note\n" }), colorScheme: scheme, storage: ctx.OPEN });
        ctx.openOnes.push(h.context);
        await selectSession(h.page, "w1");
        await ctx.openFile(h.page, "x.py");
      } else await h.page.emulateMedia({ colorScheme: scheme });
      await h.page.locator(`html[data-mantine-color-scheme="${scheme}"]`).waitFor();
      await h.page.locator(".pi-file[data-path=\"x.py\"] .cm-content .tok-keyword").first().waitFor();
      colours[scheme] = await h.page.evaluate(() => {
        const probe = (expression) => { const node = document.createElement("span"); node.style.color = expression; document.querySelector(".pi-file-editor").append(node); const value = getComputedStyle(node).color; node.remove(); return value; };
        const painted = (cls) => getComputedStyle(document.querySelector(`.pi-file .cm-content .${cls}`)).color;
        return { keyword: [painted("tok-keyword"), probe("var(--pi-syn-keyword)")], string: [painted("tok-string"), probe("var(--pi-syn-string)")], comment: [painted("tok-comment"), probe("var(--pi-syn-comment, var(--pi-code-dim))")], editorBg: [getComputedStyle(document.querySelector(".pi-file .cm-editor")).backgroundColor, probe("var(--pi-code-bg)")] };
      });
      for (const [what, [actual, expected]] of Object.entries(colours[scheme])) assert.equal(actual, expected, `${scheme}: ${what} follows its theme variable`);
      await ctx.finish(h, `highlighting ${scheme}`, false);
    }
    assert.notEqual(colours.light.keyword[0], colours.dark.keyword[0], "the two schemes paint keywords differently");
    await h.context.close();
  });
}

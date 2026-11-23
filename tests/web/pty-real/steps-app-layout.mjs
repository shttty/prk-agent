import assert from "node:assert/strict";
import { openPage } from "./page-driver.mjs";
import { observeTerminal, assertSttyMatches } from "./layout-probe.mjs";

/**
 * The user's two terminal size symptoms in the REAL App against the real PTY fixture, desktop in the dark colour scheme of the
 * user's screenshots (the App's own "auto" scheme following the browser's dark preference): (1) terminal opened first, then a
 * real file opened and split to the right — the terminal must narrow to its own group; (2) switch session and come back
 * without a reload — the terminal must fill its panel, on the same shell generation. Plus a terminal created while the
 * workspace is closed, a model → shell tab switch, and phone. Each state is observed (geometry, real pixels, last size sent)
 * BEFORE anything touches the terminal; only then is `stty size` typed, and it must agree with the observed size without the
 * page having to send a new one.
 */
export function appLayoutSteps(rig, state) {
  const [a, b] = rig.fixture.sessions.map((session) => session.sessionId);
  const file = rig.fixture.sampleFile.path;
  const settle = (d) => d.page.waitForTimeout(1500);
  const workspaceSelector = (d) => d.compact ? '#workspace-pane[data-compact="true"]:not([hidden])' : '#desktop-stage[data-open="true"]';
  const workspaceShown = (d) => d.page.locator(workspaceSelector(d)).count();
  const select = async (d, id, phone = false) => {
    if (phone && await workspaceShown(d)) await d.page.locator("#toggle-workspace").click();
    if (phone && await d.page.locator("#open-sidebar").isVisible()) await d.page.locator("#open-sidebar").click();
    await d.page.locator(`[data-session-id="${id}"] .management-session-select`).click();
    await d.page.locator(`[data-session-id="${id}"][aria-current="true"]`).waitFor({ state: "attached" });
  };
  const openWorkspace = async (d) => { if (!(await workspaceShown(d))) await d.page.locator("#toggle-workspace").click(); await d.page.locator(workspaceSelector(d)).waitFor(); };
  const connected = async (d, shell) => { await d.tab(shell).waitFor(); await d.status(shell, "connected"); };
  return [
    ["app desktop (fig. 1): terminal first, then a real file split to the right — the terminal stays in its group with the narrower size", async () => {
      const d = state.d = await openPage(rig, { name: "app", app: true, colorScheme: "dark" });
      await select(d, a); await openWorkspace(d); await connected(d, "shell"); await settle(d);
      state.full = await observeTerminal(d, "shell", "A terminal alone");
      assert.equal(state.full.scheme, "dark", "the App resolved its dark scheme");
      await d.shot("31-terminal-alone");
      await d.page.locator("#toggle-tree").click();
      await d.page.locator(`#file-tree li[data-path="${file}"] .pi-files-row`).click();
      await d.page.locator(`.pi-file[data-path="${file}"] .pi-markdown`).filter({ hasText: "Terminal workspace" }).waitFor();
      const group = d.page.locator("#desktop-stage .dv-groupview").filter({ has: d.tab("shell") });
      const area = await group.boundingBox();
      await d.page.locator(`.pi-tab[data-path="${file}"]`).dragTo(group, { targetPosition: { x: Math.round(area.width * 0.92), y: Math.round(area.height / 2) } });
      for (let i = 0; i < 50 && (await d.page.locator("#desktop-stage .dv-groupview").count()) < 3; i++) await d.page.waitForTimeout(100);
      assert.equal(await d.page.locator("#desktop-stage .dv-groupview").count(), 3, "the stage holds the chat and two split workspace groups");
      await settle(d);
      const split = await observeTerminal(d, "shell", "A terminal left of the file");
      const fileBox = await d.page.locator(`.pi-file[data-path="${file}"]`).boundingBox();
      assert.ok(split.term.r <= fileBox.x + 1.5, `the terminal ends before the file group starts (${split.term.r} vs ${fileBox.x})`);
      assert.ok(split.sent.cols < state.full.sent.cols, `cols followed the split: ${state.full.sent.cols} → ${split.sent.cols}`);
      await d.shot("32-terminal-file-split");
      await assertSttyMatches(d, "shell", split, "after the split");
    }],
    ["app desktop: apply workspace-main layout and chat-main layout — terminals stay inside their groups and keep their identity", async () => {
      const d = state.d;
      await d.tab("shell").click();
      const xterm = await d.page.locator('.pi-term[data-shell="shell"] .xterm').elementHandle();
      const generation = d.sockets("shell").at(-1).snapshot.generation;
      const sockets = d.sockets("shell").length;
      // Every animation frame from the click on: the box the terminal is drawn in (.pi-term-host) against its group's content.
      const frames = async (action) => {
        await d.page.evaluate(() => {
          window.__frames = []; window.__recording = true;
          const box = (e) => { const r = e?.getBoundingClientRect(); return r ? { x: r.x, w: r.width } : null; };
          const tick = () => {
            if (!window.__recording) return;
            const tab = document.querySelector('.pi-tab[data-kind="terminal"][data-shell="shell"]');
            window.__frames.push({ host: box(document.querySelector('.pi-term[data-shell="shell"] .pi-term-host')), group: box(tab?.closest(".dv-groupview")?.querySelector(".dv-content-container")) });
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        await action();
        await d.page.waitForTimeout(800);
        return d.page.evaluate(() => { window.__recording = false; return window.__frames; });
      };
      for (const [label, preset, side] of [["workspace main", "builtin:2", "left"], ["chat main", "builtin:1", "right"]]) {
        await d.page.locator("#layout-presets").click();
        const seen = await frames(() => d.page.locator(`[data-action="apply-layout"][data-preset="${preset}"]`).click());
        const workspace = await d.page.locator("#desktop-stage .dv-groupview").filter({ has: d.tab("shell") }).boundingBox();
        const chat = await d.page.locator("#desktop-stage .dv-groupview").filter({ has: d.page.locator(".pi-chatcol") }).boundingBox();
        assert.ok(side === "left" ? workspace.x + workspace.width <= chat.x : chat.x + chat.width <= workspace.x, `${label}: workspace is ${side} of the chat`);
        assert.equal(await d.page.locator(`.pi-tab[data-path="${file}"]`).count(), 1, `${label}: the file tab survives`);
        assert.equal(await d.tab("shell").count(), 1, `${label}: the shell tab survives`);
        assert.equal(await xterm.evaluate((node) => node === document.querySelector('.pi-term[data-shell="shell"] .xterm')), true, `${label}: the same xterm node survives`);
        assert.equal(d.sockets("shell").length, sockets, `${label}: the shell did not reconnect`);
        assert.equal(d.sockets("shell").at(-1).snapshot.generation, generation, `${label}: the shell generation survives`);
        const outside = seen.filter((f) => f.host && f.group && f.host.w > 0 && (f.host.x < f.group.x - 1 || f.host.x + f.host.w > f.group.x + f.group.w + 1));
        await rig.log({ layoutPreset: { label, frames: seen.length, outside } });
        assert.ok(seen.length > 5, `${label}: frames were recorded`);
        assert.deepEqual(outside, [], `${label}: the terminal stays inside its group in every frame`);
      }
      await d.page.mouse.move(1, 1);
      await settle(d);
      const back = await observeTerminal(d, "shell", "A after applying both built-in layouts");
      state.baseline = back; // Built-in layout 1 merges the file and shell into one workspace group.
      await d.shot("32b-after-layout-presets");
      await assertSttyMatches(d, "shell", back, "after the built-in layouts");
    }],
    ["app desktop (fig. 2): switch to session B and back without a reload — the terminal fills its panel", async () => {
      const d = state.d;
      await select(d, b); await openWorkspace(d); await connected(d, "shell"); await settle(d);
      const other = await observeTerminal(d, "shell", "B after switching");
      await d.shot("33-b");
      await assertSttyMatches(d, "shell", other, "B");
      await select(d, a); await openWorkspace(d); await connected(d, "shell"); await settle(d);
      const back = await observeTerminal(d, "shell", "A after switching back");
      // The remounted stage makes a new xterm in the saved group: same host and rows; observeTerminal checks the exact fit.
      assert.deepEqual([Math.round(back.host.w), Math.round(back.host.h), back.sent.rows], [Math.round(state.baseline.host.w), Math.round(state.baseline.host.h), state.baseline.sent.rows], "back on A: the saved group size and rows survive the switch");
      const onA = d.sockets("shell").filter((entry) => entry.session === a);
      assert.equal(onA.at(-1).generationQuery, onA[0].snapshot.generation, "coming back re-subscribed the same shell generation");
      await d.shot("34-a-back");
      await assertSttyMatches(d, "shell", back, "A back");
    }],
    ["app desktop: a terminal created while the workspace is closed, shown by its tab, then back to the shell tab", async () => {
      const d = state.d;
      await d.page.locator("#toggle-workspace").click();
      await d.page.locator('#desktop-stage:not([data-open])').waitFor({ state: "attached" });
      await rig.fixture.openModel(a, "model");
      await select(d, b); await select(d, a); // the session's terminal list is read when its workspace is shown again
      // A tab the list opened in the background keeps its terminal outside the document until it is shown (the renderer that
      // keeps a terminal inside its group, TERMINAL_RENDERER), so it is shown first and its view then reads as connected.
      await openWorkspace(d); await d.tab("model").waitFor();
      for (let i = 0; i < 100 && !d.sockets("model").some((entry) => entry.snapshot && entry.closeCode === null); i++) await d.page.waitForTimeout(100);
      assert.ok(d.sockets("model").some((entry) => entry.snapshot && entry.closeCode === null), "the background tab's terminal is attached before it is shown");
      await d.tab("model").click(); await connected(d, "model"); await settle(d);
      const model = await observeTerminal(d, "model", "model created while closed, shown by its tab");
      await d.shot("35-model-tab");
      await assertSttyMatches(d, "model", model, "model");
      await d.tab("shell").click(); await settle(d);
      const shell = await observeTerminal(d, "shell", "shell after switching tabs back");
      await d.shot("35b-shell-tab");
      await assertSttyMatches(d, "shell", shell, "shell tab back");
    }],
    ["app phone: open, switch to session B and back — the terminal fills the overlay", async () => {
      const p = state.p = await openPage(rig, { name: "app-phone", app: true, compact: true });
      await select(p, a, true); await openWorkspace(p); await connected(p, "shell"); await settle(p);
      const first = await observeTerminal(p, "shell", "phone A");
      await select(p, b, true); await openWorkspace(p); await connected(p, "shell"); await settle(p);
      await observeTerminal(p, "shell", "phone B");
      await select(p, a, true); await openWorkspace(p); await connected(p, "shell"); await settle(p);
      const back = await observeTerminal(p, "shell", "phone A back");
      assert.deepEqual([Math.round(back.host.w), Math.round(back.host.h), back.sent.rows], [Math.round(first.host.w), Math.round(first.host.h), first.sent.rows]);
      assert.deepEqual(back.sent, first.sent, "phone: the same size as before the switch");
      await p.shot("36-phone-a-back");
      await assertSttyMatches(p, "shell", back, "phone A back");
    }],
    ["app runs: no page errors and no failed responses", async () => {
      for (const driver of [state.d, state.p]) {
        assert.deepEqual(driver.seen.errors, [], `${driver.name} page errors`);
        assert.deepEqual(driver.seen.failed, [], `${driver.name} failed responses`);
      }
    }],
  ];
}

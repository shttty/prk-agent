// 1. Away from the bottom: floating elevated circle; new content: pill; neither takes document flow; click: back at bottom.
// 2. Workspace overlay with a terminal tab: the one toggle opens it, a single tab strip, xterm under it, no drawer or dock splitter.
import assert from "node:assert/strict";
import { join } from "node:path";
import { openMockWorkbench } from "../../fixtures/workspace-mock.mjs";
import { createMockFs } from "../../fixtures/workspace-mock/create-mock-fs.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";

export async function checkComposerAndTranscript(ctx) {
Object.defineProperties(ctx, {
    h: { configurable: true, get: () => h },
    page: { configurable: true, get: () => page },
    context: { configurable: true, get: () => context },
    shot: { configurable: true, get: () => shot },
    dock: { configurable: true, get: () => dock },
});

const catalog = { version: 1, commands: [], actions: [], inputPrefixes: [{ prefix: "/", enabled: true }], resources: [], attachments: { enabled: true, imageMimeTypes: [] }, references: { targetFile: { enabled: true, candidates: [] } } };

const terminalReplay = "user@host ~/workspace $ ls --color=always\r\n\x1b[01;34mtmp\x1b[0m  \x1b[01;34mVideos\x1b[0m  \x1b[01;34mworkspace\x1b[0m  README.md\r\nuser@host ~/workspace $ ";

const h = await openMockWorkbench(ctx.browser, ctx.server.url, { fs: createMockFs({ "a.txt": "x\n" }), sessions: ctx.sessions, snapshots: ctx.snapshots, routes: { "/api/sessions/w1/native": () => catalog }, terminalReplay, colorScheme: ctx.scheme, viewport: { width: 390, height: 844 }, mobile: true, storage: { "pi-session-theme": ctx.scheme } });

const { page, context } = h;

const shot = async (name) => { if (!ctx.evidence) return; await page.waitForTimeout(200); await page.screenshot({ path: join(ctx.evidence, `phone-${ctx.scheme}-${name}.png`) }); };

await page.locator("#open-sidebar").click();

await selectSession(page, "w1");

const jump = page.locator("#new-messages");

const atBottom = () => page.waitForFunction(() => { const node = document.querySelector("#transcript"); return node && node.scrollHeight - node.clientHeight - node.scrollTop < 4; });

await page.evaluate(() => { const node = document.querySelector("#transcript"); node.scrollTop = node.scrollHeight; });

await atBottom();

await jump.waitFor({ state: "hidden" });

const flowBefore = await page.evaluate(() => {
      const transcript = document.querySelector("#transcript").getBoundingClientRect();
      const last = document.querySelector("#messages > :last-child").getBoundingClientRect();
      return { transcriptBottom: transcript.bottom, lastBottomAtEnd: last.bottom + document.querySelector("#transcript").scrollTop };
    });

// A reader scroll (wheel), not a scrollTop write: only reader input stops following.
await page.locator("#transcript").hover();
await page.mouse.wheel(0, -100000);
await page.waitForFunction(() => document.querySelector("#transcript").scrollTop === 0);

await page.locator('#new-messages[data-kind="away"]').waitFor({ state: "visible" });

const jumpStyle = await page.evaluate(() => {
      const btn = document.querySelector("#new-messages");
      const cs = getComputedStyle(btn);
      const resolve = (prop, token) => {
        const probe = document.createElement("div");
        probe.style[prop] = `var(${token})`;
        document.body.appendChild(probe);
        const val = getComputedStyle(probe)[prop];
        probe.remove();
        return val;
      };
      const transcript = document.querySelector("#transcript").getBoundingClientRect();
      const last = document.querySelector("#messages > :last-child").getBoundingClientRect();
      const composer = document.querySelector("#composer-form").getBoundingClientRect();
      const rect = btn.getBoundingClientRect();
      return {
        position: cs.position,
        bg: cs.backgroundColor,
        expectedBg: resolve("backgroundColor", "--pi-surface"),
        border: cs.borderTopColor,
        expectedBorder: resolve("borderTopColor", "--pi-line-strong"),
        shadow: cs.boxShadow,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
        composerTop: composer.top,
        transcriptBottom: transcript.bottom,
        lastBottomAtTop: last.bottom,
      };
    });

assert(["absolute", "fixed"].includes(jumpStyle.position), `${ctx.scheme}: #new-messages is out of document flow (${jumpStyle.position})`);

assert.equal(jumpStyle.transcriptBottom, flowBefore.transcriptBottom, `${ctx.scheme}: showing #new-messages does not move #transcript bottom`);

assert.equal(Math.round(jumpStyle.lastBottomAtTop), Math.round(flowBefore.lastBottomAtEnd), `${ctx.scheme}: last message line bottom coordinate is unchanged`);

assert(Math.abs(jumpStyle.rect.width - jumpStyle.rect.height) <= 1 && jumpStyle.rect.width >= 40, `${ctx.scheme}: away button is a >=40px circle (${jumpStyle.rect.width}x${jumpStyle.rect.height})`);

assert(jumpStyle.rect.bottom <= jumpStyle.composerTop, `${ctx.scheme}: jump button floats above the composer`);

assert.equal(jumpStyle.bg, jumpStyle.expectedBg, `${ctx.scheme}: jump button uses --pi-surface`);

assert.equal(jumpStyle.border, jumpStyle.expectedBorder, `${ctx.scheme}: jump button uses --pi-line-strong`);

assert.notEqual(jumpStyle.shadow, "none", `${ctx.scheme}: jump button has elevated shadow`);

await shot("scrolled-up");

await page.evaluate((event) => {
      const source = window.__eventSources.findLast((candidate) => candidate.url.endsWith("/sessions/w1/events"));
      source.dispatchEvent(new MessageEvent("host", { data: JSON.stringify(event) }));
    }, { type: "message", streamId: ctx.snapshots.w1.streamId, sessionId: "w1", sequence: 40, operationId: "op-new", text: "more" });

await page.locator('#new-messages[data-kind="new"]').waitFor({ state: "visible" });

const pill = await jump.boundingBox();

assert(pill.width > jumpStyle.rect.width + 40 && pill.height >= 40, `${ctx.scheme}: new-messages pill is wider and >=40px tall (${pill.width}x${pill.height})`);

await shot("new-messages");

await jump.click();

await atBottom();

await jump.waitFor({ state: "hidden" });

await page.locator("#toggle-workspace").click();

const dock = page.locator("#workspace-pane");

await dock.waitFor({ state: "visible" });

await page.locator(".pi-term .xterm-screen").waitFor({ state: "visible" });

const geometry = () => page.evaluate(() => {
      const box = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      return { dock: box("#workspace-pane"), bar: box(".pi-pane-bar"), tabs: box(".dv-tabs-and-actions-container"), screen: box(".pi-term .xterm-screen"), view: box(".pi-term") };
    });

const before = await geometry();

assert(before.bar.top === before.dock.top && before.tabs.top >= before.bar.bottom - 1, `${ctx.scheme}: the overlay's bar sits on top of the one tab strip`);

assert(before.screen.top >= before.tabs.bottom - 1 && before.view.left === before.dock.left, `${ctx.scheme}: the terminal fills the overlay under the tab strip`);

assert.equal(await page.locator("#terminal-drawer, #terminal-drawer-toggle, .pi-term-bar, #workspace-pane > .pi-splitter").count(), 0, `${ctx.scheme}: no drawer, no second tab row, no dock splitter on the phone`);

assert.deepEqual(await page.locator("#workspace-pane .pi-pane-bar button").evaluateAll((nodes) => nodes.map((node) => node.id)), ["toggle-tree", "new-terminal", "toggle-workspace"], `${ctx.scheme}: the bar holds the directory, new terminal and close buttons`);

await shot("terminal-open");

}

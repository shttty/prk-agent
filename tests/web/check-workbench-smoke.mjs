// Render smoke (check:quick): mock one worker, open its session and require the chat and composer on screen with
// no uncaught page error; then open the workspace and the terminal so the lazy chunks load too. lint has no way to see
// a deleted import used at render time (daily's chat was blank for 1.5 h that way); this does.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { SNAPSHOTS } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { assertUniqueIds } from "../fixtures/workspace-mock/assert-unique-ids.mjs";
import { createMockFs } from "../fixtures/workspace-mock/create-mock-fs.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";

// A real transcript, so the message components (user, assistant markdown, tool row, turn fold) render too.
const now = Date.now();
const messages = [
  { role: "user", content: [{ type: "text", text: "SMOKE_USER" }], timestamp: now - 9000 },
  { role: "assistant", content: [{ type: "text", text: "looking" }, { type: "toolCall", id: "t1", name: "kernel_code", arguments: { code: "print(1)" } }], timestamp: now - 8000, stopReason: "toolUse" },
  { role: "toolResult", toolCallId: "t1", toolName: "kernel_code", content: [{ type: "text", text: "1" }], timestamp: now - 7000 },
  { role: "assistant", content: [{ type: "text", text: "SMOKE_ANSWER **done**" }], timestamp: now - 6000, stopReason: "stop" },
];
const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, messages, messageEntryIds: messages.map((_, index) => `e${index}`) } };
const targets = [{ id: "alpha", label: "Alpha", local: true, cwd: "/data", python: "/usr/bin/python3" }];
const routes = {
  "/api/targets/alpha": () => ({ target: targets[0] }),
  "/api/capabilities": () => ({ catalog: CATALOG }),
  "/api/tools/list": () => ({ tools: [] }),
};
// Two non-empty providers: the tools page lists them with counts on the left and shows one on the right.
const capability = (name, group, description) => ({ id: `tool:${name}`, kind: "tool", name, description, group, groupLabel: group.slice(20), source: `/plugins/${name}.ts`, enabled: true, configured: true, overridden: false, groupEnabled: true });
const CATALOG = {
  entries: [capability("alpha_one", "group:tools:package:alpha-pkg", "First.\nSecond line."), capability("alpha_two", "group:tools:package:alpha-pkg", "Other."), capability("beta_one", "group:tools:package:beta-pkg", "Beta.")],
  groups: [{ id: "group:tools:package:alpha-pkg", name: "alpha-pkg", kind: "tool", enabled: true }, { id: "group:tools:package:beta-pkg", name: "beta-pkg", kind: "tool", enabled: true }, { id: "group:tools:package:empty-pkg", name: "empty-pkg", kind: "tool", enabled: true }],
};

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  for (const phone of [false, true]) {
    const label = phone ? "phone" : "desktop";
    const { context, page, problems } = await openMockWorkbench(browser, server.url, {
      fs: createMockFs({ "a.txt": "x" }),
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      mobile: phone,
      targets,
      routes,
      snapshots,
    });
    if (phone) await page.locator("#open-sidebar").click();
    await selectSession(page, "w1");
    if (phone) await page.locator("#open-sidebar").click();
    await page.locator("#create-session").click();
    await page.locator("#create-session-target").waitFor();
    await page.locator("#create-session-target").click();
    const selectedTarget = page.locator('[role="option"][value="alpha"]:visible');
    await selectedTarget.waitFor();
    assert.equal(await selectedTarget.getAttribute("aria-selected"), "true", `${label}: new session defaults to the configured local instance`);
    await page.keyboard.press("Escape");
    await page.locator("#confirm-create-session").waitFor();
    await page.locator('[data-action="cancel"]').click();
    await page.locator(".pi-chat").waitFor();
    assert.equal(await page.locator("#composer").isVisible(), true, `${label}: composer renders`);
    await page.getByText("SMOKE_USER").waitFor();
    await page.getByText("SMOKE_ANSWER").waitFor();
    assert.equal(await page.locator("#topbar-title").textContent(), "worker", `${label}: session title hook`);
    // Workspace + terminal: the lazy chunks (dockview, CodeMirror, xterm) must load and render. One toggle opens the
    // workspace, which opens a terminal tab by itself (phone: in the workspace overlay; desktop: in the stage grid beside
    // the chat).
    await page.locator("#toggle-workspace").click();
    await page.locator(".pi-term .xterm").waitFor();
    await page.locator(phone ? "#editor-area" : '#desktop-stage[data-open="true"]').waitFor({ state: "attached" });
    await page.locator("#toggle-tree").click();
    await page.locator("#files-panel").waitFor({ state: "visible" });
    await assertUniqueIds(page, `${label}: workspace + terminal`);
    await page.keyboard.press("Escape");
    await page.locator("#toggle-workspace").click();
    if (phone) await page.locator("#open-sidebar").click();
    await page.locator("#open-settings").click();
    const shell = page.locator(".pi-settings-shell");
    if (phone) assert.equal(await shell.getAttribute("data-mode"), "list", `${label}: settings open as a full list`);
    await page.locator("#open-general").click();
    await page.locator('#settings-content[data-section="general"] #settings-theme').waitFor();
    if (phone) {
      assert.equal(await shell.getAttribute("data-mode"), "content", `${label}: the list folds into a rail`);
      await page.locator("#settings-back").click();
      await page.locator('.pi-settings-shell[data-mode="list"]').waitFor();
    } else {
      const nav = await page.locator("#settings-navigation").boundingBox();
      const content = await page.locator("#settings-content").boundingBox();
      assert(nav.x + nav.width <= content.x, "desktop navigation is left of settings content");
    }
    await page.locator("#open-archive").click();
    await page.locator('#settings-content[data-section="archive"] #archive-filter-text').waitFor();
    assert.equal(await page.locator('[role="dialog"]:visible').count(), 1, "navigation stays in one settings surface");
    // Tools: provider list (counts, empty providers hidden) | one provider's switches; details in a card.
    await page.locator("#open-tool-library").click({ position: { x: 20, y: 20 } });
    const provider = (id) => page.locator(`#tools-sources [data-provider="group:tools:package:${id}"]`);
    assert.equal(await provider("alpha-pkg").getAttribute("data-count"), "2", `${label}: provider carries its count`);
    assert.equal(await provider("empty-pkg").count(), 0, `${label}: empty providers are hidden`);
    await page.locator("#tools-search").fill("one");
    await provider("beta-pkg").waitFor();
    assert.equal(await provider("alpha-pkg").locator("[data-hit]").getAttribute("data-hit"), "true", `${label}: search narrows a provider to its matches`);
    await page.locator("#tools-search").fill("");
    await provider("alpha-pkg").locator(".capability-provider-name").click();
    const rows = phone ? page.locator("#capability-sheet") : page.locator("#settings-content .pi-fade-live");
    await rows.locator('[data-capability="tool:alpha_one"]').waitFor();
    assert.equal(await rows.locator('[data-provider-section="group:tools:package:alpha-pkg"] [data-capability]').count(), 2, `${label}: provider section lists its entries`);
    await rows.locator('[data-capability-group="group:tools:package:alpha-pkg"] [data-stop="on"]').waitFor({ state: "attached" });
    await assertUniqueIds(page, `${label}: tools settings`);
    if (phone) {
      await page.locator("#capability-sheet [data-action='close-provider']").click();
      await page.locator('.capability-layer[data-open="false"]').first().waitFor({ state: "attached" });
    } else {
      await rows.locator('[data-capability="tool:alpha_one"] .capability-name').hover();
      await page.locator('#capability-peek[data-open="true"] [data-field="source"]').waitFor();
      assert.equal(await page.locator('#capability-peek [data-field="source"]').textContent(), "/plugins/alpha_one.ts", `${label}: hover shows the detail card`);
    }
    await page.locator("#close-settings").click();
    assert.deepEqual(problems, [], `${label}: page errors`);
    await context.close();
    console.log(`PASS ${label}: chat, composer, workspace and terminal render without page errors`);
  }
} finally {
  await browser.close();
  await server.close();
}

import { widthsHold } from "./workspace-editor/widths-hold.mjs";
import { messUp } from "./workspace-editor/mess-up.mjs";
import { checkDesktopAndPhoneChrome } from "./workspace-editor/check-desktop-and-phone-chrome.mjs";
import { checkTabsAndFileActions } from "./workspace-editor/check-tabs-and-file-actions.mjs";
import { checkLayoutPersistence } from "./workspace-editor/check-layout-persistence.mjs";
import { checkWidthFit } from "./workspace-editor/check-width-fit.mjs";
import { checkSidebarAndEditorSelection } from "./workspace-editor/check-sidebar-and-editor-selection.mjs";
import { checkLayoutReset } from "./workspace-editor/check-layout-reset.mjs";
import { checkTerminalAndCopy } from "./workspace-editor/check-terminal-and-copy.mjs";
import { checkControlsAndMobileTree } from "./workspace-editor/check-controls-and-mobile-tree.mjs";
import { checkContainmentAndTerminalClose } from "./workspace-editor/check-containment-and-terminal-close.mjs";
import { checkUnifiedWorkspace } from "./workspace-editor/check-unified-workspace.mjs";
import { REGIONS, regionBleed } from "./workspace-editor/region-bleed.mjs";
import { boxes, near, dragBy } from "./workspace-editor/stage-geometry.mjs";
// Desktop stage in a real browser (check:full): chrome collapse/expand across saved states and session kinds,
// file/diff/terminal tabs around the chat, split by drag, save/conflict, persistence and lazy restore, directory
// popover/pinned column, and unchanged phone overlay. API mocked at the browser; Vite serves the real web/.
// Nothing here locates by UI copy: ids, data-* and classes only.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { assertUniqueIds } from "../fixtures/workspace-mock/assert-unique-ids.mjs";
import { createMockFs } from "../fixtures/workspace-mock/create-mock-fs.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { loadFirefox } from "../fixtures/workspace-mock/load-firefox.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { layoutStorage as seed } from "../fixtures/layout-code.mjs";

// Pinned directory scenarios start with its independent stage column open.
const OPEN = seed({ workspaceOpen: true, treeOpen: true, treePinned: true });

const FILES = { "README.md": "# Title\n\nhello", "main.py": "print('hi')\n", "notes.txt": "plain", "src/a.py": "a = 1\n", "src/b.py": "b = 2\n", ".env": "X=1" };
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
const firefox = await loadFirefox(); // null unless PI_TEST_FIREFOX
const openOnes = [];
const done = [];

// The terminal list is unreachable by default: nothing opens a shell on its own, so the dock holds only what a step puts in
// it (the terminal steps pass `terminals: []`).
async function open({ engine = browser, ...options } = {}, session = "w1") {
  const fs = createMockFs(FILES);
  const handle = await openMockWorkbench(engine, server.url, { fs, terminals: null, ...options });
  openOnes.push(handle.context);
  await selectSession(handle.page, session);
  return { ...handle, fs };
}
async function finish(handle, label, close = true) {
  // Firefox reports a font it could not fetch as a page error; that is the dev server's file access, not the page.
  assert.deepEqual(handle.problems.filter((problem) => !problem.startsWith("download failed (font-family")), [], `${label}: page errors`);
  if (close) await handle.context.close();
}
// Reuse only identical mock/device fixtures. A new document and explicit storage seed keep scenarios independent.
async function restart(handle, storage = {}, session = "w1", viewport) {
  if (viewport) await handle.page.setViewportSize(viewport);
  await handle.page.evaluate((values) => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("seeded", "1");
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, storage);
  await handle.page.reload();
  if (await handle.page.locator("#open-sidebar").isVisible()) await handle.page.locator("#open-sidebar").click();
  await selectSession(handle.page, session);
}
const row = (page, path) => page.locator(`#file-tree li[data-path="${path}"] .pi-files-row`);
const tab = (page, path) => page.locator(`.pi-tab[data-path="${path}"]`);
const body = (page, path) => page.locator(`.pi-file[data-path="${path}"]`);
const groups = (page) => page.locator("#desktop-stage .dv-groupview").count();
const tabs = (page) => page.locator(".pi-tab").count();
const stored = (page, key) => page.evaluate((name) => localStorage.getItem(name), key);
// Picks the file in the directory tree; a popover tree that is closed (it closes itself after every pick) is opened first.
async function openFile(page, path) {
  if (!(await page.locator("#file-tree").isVisible()) && await page.locator("#toggle-tree").count()) await page.locator("#toggle-tree").click();
  await row(page, path).click();
  await tab(page, path).waitFor();
}
async function editor(page, path) {
  const content = body(page, path).locator(".cm-content");
  await content.waitFor();
  return content;
}
async function type(page, path, text) {
  await (await editor(page, path)).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
}
const width = async (page, selector) => (await page.locator(selector).boundingBox()).width;
const stageOpen = (page) => page.locator("#desktop-stage").evaluate((stage) => stage.dataset.open === "true");
async function toggleWorkspace(page, want, step) {
  await page.locator("#toggle-workspace").click();
  await page.waitForFunction((open) => (document.querySelector("#desktop-stage")?.dataset.open === "true") === open, want, { timeout: 20000 });
  await assertUniqueIds(page, step);
}
/** Drag a tab onto its workspace group's right edge: dockview splits a new group off. */
async function dragToRightEdge(page, path) {
  const area = await tab(page, path).locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' dv-groupview ')]").boundingBox();
  const box = await tab(page, path).boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 60, { steps: 4 });
  await page.mouse.move(area.x + area.width - 30, area.y + area.height / 2, { steps: 12 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(300);
}
async function step(name, run) {
  if (process.env.PRK_STEP && !name.includes(process.env.PRK_STEP)) return; // debugging: run one step
  const t0 = Date.now();
  await run();
  done.push(name);
  console.log(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

try {
const ctx = {
  widthsHold: (...args) => widthsHold(ctx, ...args),
  messUp: (...args) => messUp(ctx, ...args),
  get FILES() { return FILES; },
  get OPEN() { return OPEN; },
  get REGIONS() { return REGIONS; },
  get body() { return body; },
  get browser() { return browser; },
  get dragToRightEdge() { return dragToRightEdge; },
  get editor() { return editor; },
  get finish() { return finish; },
  get firefox() { return firefox; },
  get groups() { return groups; },
  get open() { return open; },
  get openFile() { return openFile; },
  get openOnes() { return openOnes; },
  get stageOpen() { return stageOpen; },
  get regionBleed() { return regionBleed; },
  get restart() { return restart; },
  get row() { return row; },
  get server() { return server; },
  get step() { return step; },
  get stored() { return stored; },
  get tab() { return tab; },
  get tabs() { return tabs; },
  get toggleWorkspace() { return toggleWorkspace; },
  get type() { return type; },
  get width() { return width; },
  get boxes() { return boxes; },
  get near() { return near; },
  get dragBy() { return dragBy; },
};
await checkDesktopAndPhoneChrome(ctx);
await checkTabsAndFileActions(ctx);
await checkLayoutPersistence(ctx);
await checkWidthFit(ctx);
await checkSidebarAndEditorSelection(ctx);
await checkLayoutReset(ctx);
await checkTerminalAndCopy(ctx);
await checkControlsAndMobileTree(ctx);
await checkContainmentAndTerminalClose(ctx);
await checkUnifiedWorkspace(ctx);
} finally {
  await browser.close();
  await firefox?.close();
  await server.close();
}
console.log(`PASS workspace editor browser suite (${done.length} steps)`);

// Real workspace terminal (useTerminalSession + xterm addons) against a scripted terminal socket.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";

const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const server = await startWebDev("http://127.0.0.1:9");
let browser;
const open = async () => {
  const h = await openMockWorkbench(browser, server.url, { storage: { "pi.layout.workspaceOpen": "true" }, terminals: [{ name: "shell", owner: "user" }], terminalReplay: "", search: "#sessionId=w1" });
  const terminal = h.page.locator('.pi-term[data-shell="shell"]');
  await terminal.locator('.pi-term-view[data-status="connected"]').waitFor();
  const socket = () => h.sockets.at(-1);
  return { ...h, terminal, socket, send: (data) => socket().send({ type: "stdout", data }), shot: async (name) => { if (evidence) await terminal.screenshot({ path: join(evidence, `terminal-${name}.png`) }); } };
};

async function searchAndZoom() {
  const { page, context, terminal, socket, send, shot, problems } = await open();
  try {
    send(Array.from({ length: 150 }, (_, index) => `needle ${index}\r\n`).join(""));
    await page.waitForFunction(() => document.querySelector(".xterm-rows")?.textContent.includes("needle 149"));
    await terminal.locator("textarea.xterm-helper-textarea").focus();
    await page.keyboard.press("Control+Shift+F");
    const bar = terminal.locator('[data-kind="terminal-search"]');
    await bar.locator("input").waitFor();
    await page.keyboard.type("needle");
    await bar.and(page.locator('[data-count="100"]')).waitFor();
    await shot("search");
    await page.keyboard.press("Escape");
    await bar.waitFor({ state: "detached" });

    const sizes = () => socket().received.filter((frame) => frame.type === "resize");
    const before = sizes().at(-1);
    assert.ok(before, "the terminal reported its size on attach");
    const inputs = socket().received.filter((frame) => frame.type === "input").length;
    for (let step = 0; step < 3; step += 1) await page.keyboard.press("Control+Equal");
    await page.waitForFunction(() => localStorage.getItem("pi-terminal-font-size") === "16");
    await page.waitForTimeout(400);
    const zoomed = sizes().at(-1);
    assert.ok(zoomed.cols < before.cols && zoomed.rows < before.rows, `bigger font refits and resizes the PTY: ${JSON.stringify([before, zoomed])}`);
    await shot("zoomed");
    await page.keyboard.press("Control+Minus");
    await page.waitForFunction(() => localStorage.getItem("pi-terminal-font-size") === "15");
    await page.keyboard.press("Control+0");
    await page.waitForFunction(() => localStorage.getItem("pi-terminal-font-size") === "13");
    await page.waitForTimeout(400);
    assert.deepEqual(sizes().at(-1), before, "the default size restores the PTY size");
    assert.equal(socket().received.filter((frame) => frame.type === "input").length, inputs, "zoom keys never reach the PTY");
    assert.deepEqual(problems, []);
    console.log("PASS search highlights at most 100 matches; Ctrl +/-/0 zoom refits and resizes the PTY");
  } finally { await context.close(); }
}

// Pixels of one colour on the image layer canvases (Sixel and Kitty draw there, on 2D canvas, no WebGL).
const countPixels = (page, [r, g, b]) => page.evaluate((rgb) => [...document.querySelectorAll('.pi-term[data-shell="shell"] canvas[class*="xterm-image-layer"]')]
  .reduce((total, canvas) => {
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let index = 0; index < data.length; index += 4) if (data[index] === rgb[0] && data[index + 1] === rgb[1] && data[index + 2] === rgb[2] && data[index + 3] === 255) count += 1;
    return total + count;
  }, 0), [r, g, b]);

async function imagesKeysAndReplay() {
  const { page, context, terminal, socket, send, shot, problems } = await open();
  try {
    // A red 200x600 Sixel image (>16 KB) arriving in 1 KB frames: the parser joins it across writes.
    const sixel = `\x1bPq"1;1;200;600#1;2;100;0;0#1${`${"~".repeat(200)}-`.repeat(100)}\x1b\\\r\n`;
    assert.ok(sixel.length > 16 * 1024);
    for (let index = 0; index < sixel.length; index += 1024) send(sixel.slice(index, index + 1024));
    await page.waitForFunction(() => document.querySelector('canvas[class*="xterm-image-layer"]'));
    await page.waitForTimeout(300);
    assert.ok(await countPixels(page, [255, 0, 0]) > 1000, "Sixel image painted");
    // A blue 16x16 Kitty graphics image (raw RGB).
    send(`\x1b_Ga=T,f=24,s=16,v=16;${Buffer.from(Array.from({ length: 256 }, () => [0, 0, 255]).flat()).toString("base64")}\x1b\\\r\nIMAGES_DONE\r\n`);
    await page.waitForFunction(() => document.querySelector(".xterm-rows")?.textContent.includes("IMAGES_DONE"));
    await page.waitForTimeout(300);
    assert.ok(await countPixels(page, [0, 0, 255]) > 100, "Kitty image painted");
    await shot("images");

    // Kitty keyboard: Shift+Enter is plain CR until the program pushes flags, then CSI 13;2u.
    const inputs = () => socket().received.filter((frame) => frame.type === "input").map((frame) => frame.data);
    await terminal.locator("textarea.xterm-helper-textarea").focus();
    await page.keyboard.press("Shift+Enter");
    send("\x1b[>1u");
    await page.waitForTimeout(200);
    await page.keyboard.press("Shift+Enter");
    await page.waitForTimeout(200);
    assert.deepEqual(inputs().slice(-2), ["\r", "\x1b[13;2u"]);

    // The old stream broke off inside a Kitty image; the next snapshot's replay must still show.
    send("\x1b_Ga=T,f=24,s=16,v=16;AAAAAAAA");
    socket().send({ type: "snapshot", name: "shell", connectionStatus: "connected", replay: "AFTER_RECONNECT\r\n" });
    await page.waitForFunction(() => document.querySelector(".xterm-rows")?.textContent.includes("AFTER_RECONNECT"), null, { timeout: 5000 });
    assert.equal(await countPixels(page, [0, 0, 255]), 0, "the snapshot reset cleared the old images");
    assert.deepEqual(problems, []);
    console.log("PASS Sixel (>16 KB in 1 KB frames) and Kitty images paint; Kitty keyboard Shift+Enter; replay after a cut image");
  } finally { await context.close(); }
}

async function quoteToComposer() {
  const { page, context, terminal, send, problems } = await open();
  try {
    send("QUOTE_LINE_1\r\nQUOTE_LINE_2\r\n");
    await page.waitForFunction(() => document.querySelector(".xterm-rows")?.textContent.includes("QUOTE_LINE_2"));
    const menuItem = page.locator('.pi-term-menu[data-shell="shell"] [data-action="quote"]');
    await terminal.locator(".xterm-screen").click({ button: "right" });
    await menuItem.waitFor();
    assert.equal(await menuItem.getAttribute("data-disabled"), "true", "no selection: nothing to quote");
    await page.keyboard.press("Escape");
    await menuItem.waitFor({ state: "detached" });
    await page.locator("#composer").fill("my question");
    await terminal.locator("textarea.xterm-helper-textarea").focus();
    await page.keyboard.press("Control+Shift+A");
    await terminal.locator(".xterm-screen").click({ button: "right" });
    await menuItem.click();
    await page.waitForFunction(() => document.getElementById("composer")?.value.includes("> QUOTE_LINE_2"));
    assert.equal(await page.locator("#composer").inputValue(), "my question\n\n> QUOTE_LINE_1\n> QUOTE_LINE_2\n");
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "composer", "focus moves to the composer");
    if (evidence) await page.screenshot({ path: join(evidence, "terminal-quote-composer.png") });
    assert.deepEqual(problems, []);
    console.log("PASS 引用到输入框 is disabled without a selection, appends the selection as a quote and focuses the composer");
  } finally { await context.close(); }
}

async function cursorBlinkPreference() {
  const { page, context, terminal, sockets, problems } = await open();
  try {
    const input = terminal.locator("textarea.xterm-helper-textarea");
    const cursor = terminal.locator(".xterm-cursor");
    const blinking = terminal.locator(".xterm-cursor.xterm-cursor-blink");
    await input.focus();
    await cursor.waitFor();
    assert.equal(await blinking.count(), 0, "the terminal cursor is steady by default");
    const opened = sockets.length;
    const preference = page.locator("#setting-terminal-cursor-blink");
    await page.locator("#open-settings").click();
    await preference.waitFor();
    assert.equal(await preference.isChecked(), false);
    await page.locator('label.pi-settings-title[for="setting-terminal-cursor-blink"]').click();
    await page.locator("#close-settings").click();
    await input.focus();
    await blinking.waitFor();
    assert.equal(sockets.length, opened, "changing blinking does not reconnect the open terminal");
    assert.equal(await page.evaluate(() => localStorage.getItem("pi-terminal-cursor-blink")), "true");
    assert.deepEqual(problems, []);
    console.log("PASS the cursor is steady by default; the browser setting enables blinking on an already open terminal");
  } finally { await context.close(); }
}

async function legacyMouse() {
  const h = await openMockWorkbench(browser, server.url, { viewport: { width: 2400, height: 900 }, storage: { "pi.layout.workspaceOpen": "true", "pi-terminal-font-size": "8" }, terminals: [{ name: "shell", owner: "user" }], terminalReplay: "", search: "#sessionId=w1" });
  const { page, context, sockets, problems } = h;
  try {
    const terminal = page.locator('.pi-term[data-shell="shell"]');
    await terminal.locator('.pi-term-view[data-status="connected"]').waitFor();
    const socket = sockets.at(-1);
    await page.waitForTimeout(400);
    const size = socket.received.filter((frame) => frame.type === "resize").at(-1);
    assert.ok(size?.cols > 100, `the terminal is wider than 95 columns: ${JSON.stringify(size)}`);
    socket.send({ type: "stdout", data: "\x1b[?1000hMOUSE_ON" });
    await page.waitForFunction(() => document.querySelector(".xterm-rows")?.textContent.includes("MOUSE_ON"));
    const box = await terminal.locator(".xterm-screen").boundingBox();
    const cell = { width: box.width / size.cols, height: box.height / size.rows };
    const at = (col, row) => ({ x: box.x + (col + 0.5) * cell.width, y: box.y + (row + 0.5) * cell.height });
    const mouse = () => socket.received.filter((frame) => frame.type === "input" && frame.data.startsWith("\x1b[M")).map((frame) => frame.data);
    await page.mouse.click(at(9, 1).x, at(9, 1).y);
    await page.waitForTimeout(300);
    // Button 1 press then release at column 10, row 2 (1-based, +32).
    assert.deepEqual(mouse(), ["\x1b[M *\"", "\x1b[M#*\""]);
    await page.mouse.click(at(size.cols - 2, 1).x, at(size.cols - 2, 1).y);
    await page.waitForTimeout(300);
    assert.equal(mouse().length, 2, "a report past column 95 is dropped whole");
    assert.deepEqual(problems, []);
    console.log("PASS X10 mouse reports reach the PTY; a report past column 95 is dropped");
  } finally { await context.close(); }
}

try {
  browser = await loadChromium();
  await searchAndZoom();
  await imagesKeysAndReplay();
  await quoteToComposer();
  await legacyMouse();
  await cursorBlinkPreference();
} finally {
  await browser?.close();
  await server.close();
}

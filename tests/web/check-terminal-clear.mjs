// Real workspace terminal and shared useTerminalSession hook; only the Gateway socket is scripted.
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
try {
  browser = await loadChromium();
  for (const [label, owner] of [["human", "user"], ["model", "model"]]) {
    const h = await openMockWorkbench(browser, server.url, {
      storage: { "pi.layout.workspaceOpen": "true" },
      terminals: [{ name: "shell", owner }], terminalReplay: "", search: "#sessionId=w1",
    });
    const { page, context, sockets, problems } = h;
    try {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: server.url });
      const terminal = page.locator('.pi-term[data-shell="shell"]');
      await terminal.locator('.pi-term-view[data-status="connected"]').waitFor();
      const rows = terminal.locator(".xterm-rows");
      const screen = () => rows.textContent();
      const waitForText = (text) => page.waitForFunction((want) =>
        document.querySelector('.pi-term[data-shell="shell"] .xterm-rows')?.textContent.includes(want), text);
      const send = (data) => sockets.at(-1).send({ type: "stdout", data });
      const shot = async (name) => {
        if (evidence) await terminal.screenshot({ path: join(evidence, `terminal-clear-${label}-${name}.png`) });
      };
      const copyAll = async () => {
        await terminal.locator("textarea.xterm-helper-textarea").focus();
        await page.evaluate(() => navigator.clipboard.writeText("pending-copy"));
        await page.keyboard.press("Control+Shift+A");
        await page.keyboard.press("Control+Shift+C");
        await page.waitForFunction(async () => (await navigator.clipboard.readText()) !== "pending-copy");
        return page.evaluate(() => navigator.clipboard.readText());
      };

      send(Array.from({ length: 80 }, (_, index) => `HISTORY_BEFORE_CLEAR_${String(index).padStart(2, "0")}\r\n`).join("") + "CURRENT_SCREEN_BEFORE_CLEAR\r\n");
      await waitForText("CURRENT_SCREEN_BEFORE_CLEAR");
      send("\x1b[2J\x1b[3J\x1b[HAFTER_CLEAR");
      await waitForText("AFTER_CLEAR");
      assert.doesNotMatch(await screen(), /BEFORE_CLEAR/, `${owner}: ED2 still clears the visible screen`);
      await shot("screen");
      const history = await copyAll();
      assert.match(history, /HISTORY_BEFORE_CLEAR_00\n/, `${owner}: ED3 retains existing scrollback`);
      assert.match(history, /CURRENT_SCREEN_BEFORE_CLEAR\n/, `${owner}: ED2 pushes the current screen into scrollback`);
      assert.match(history, /AFTER_CLEAR/, `${owner}: output after clear is retained too`);
      await terminal.locator(".xterm-screen").click();
      const pages = Math.ceil(81 / Math.max(1, (await rows.locator(":scope > div").count()) - 1));
      for (let index = 0; index < pages; index += 1) await page.keyboard.press("Shift+PageUp");
      await waitForText("HISTORY_BEFORE_CLEAR_00");
      await shot("scrollback");
      for (let index = 0; index < pages; index += 1) await page.keyboard.press("Shift+PageDown");
      await waitForText("AFTER_CLEAR");

      // Falling through keeps xterm's ED0 (including its omitted parameter) and ED1 semantics.
      for (const parameter of ["", "0"]) {
        send(`\x1b[2J\x1b[HKEEP_ABOVE\r\nKEEP_LEFTERASE_RIGHT\r\nERASE_BELOW\x1b[2;10H\x1b[${parameter}J\x1b[5;1HDEFAULT_J${parameter || "_OMITTED"}_DONE`);
        await waitForText(`DEFAULT_J${parameter || "_OMITTED"}_DONE`);
        assert.match(await screen(), /KEEP_ABOVE/);
        assert.match(await screen(), /KEEP_LEFT/);
        assert.doesNotMatch(await screen(), /ERASE_RIGHT|ERASE_BELOW/, `${owner}: ED${parameter || "default"} uses the default handler`);
      }
      send("\x1b[2J\x1b[HERASE_ABOVE\r\nERASE_LEFTKEEP_RIGHT\r\nKEEP_BELOW\x1b[2;10H\x1b[1J\x1b[5;1HDEFAULT_J1_DONE");
      await waitForText("DEFAULT_J1_DONE");
      assert.doesNotMatch(await screen(), /ERASE_ABOVE|ERASE_LEFT/, `${owner}: ED1 uses the default handler`);
      assert.match(await screen(), /KEEP_RIGHT/);
      assert.match(await screen(), /KEEP_BELOW/);
      assert.deepEqual(problems, [], `${owner}: no browser errors`);
      console.log(`PASS ${owner}: ED2/ED3 preserve history; omitted/0/1/2 J retain default screen behavior`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}

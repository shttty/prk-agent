import assert from "node:assert/strict";
import { test } from "node:test";
import { opensMenu } from "../../../../web/workspace/terminal/context-menu/opens-menu.js";
import { terminalShortcut } from "../../../../web/workspace/terminal/context-menu/terminal-shortcut.js";

const key = (code, over = {}) => ({ code, ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, ...over });

test("Ctrl+Shift+C / V / A are the terminal's clipboard keys, by physical key", () => {
  assert.deepEqual(["KeyC", "KeyV", "KeyA"].map((code) => terminalShortcut(key(code))), ["copy", "paste", "selectAll"]);
});

test("Ctrl+C, Ctrl+V, other modifiers and other keys still go to the PTY", () => {
  for (const event of [key("KeyC", { shiftKey: false }), key("KeyV", { shiftKey: false }), key("KeyA", { shiftKey: false }), key("KeyC", { altKey: true }), key("KeyC", { metaKey: true }), key("KeyC", { ctrlKey: false }), key("KeyX")]) {
    assert.equal(terminalShortcut(event), null, JSON.stringify(event));
  }
});

test("a right click opens the menu unless the program reports the mouse; Shift always opens it", () => {
  assert.equal(opensMenu("none", false), true);
  assert.equal(opensMenu("none", true), true);
  for (const mode of ["x10", "vt200", "drag", "any"]) {
    assert.equal(opensMenu(mode, false), false, mode);
    assert.equal(opensMenu(mode, true), true, mode);
  }
});

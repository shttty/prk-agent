import type { Terminal } from "@xterm/xterm";
import type { TerminalAction } from "../terminal-types.ts";
import { copyLiteral } from "../../../chat/clipboard/copy-literal.js";

// Plain-http page: no async clipboard. With xterm's textarea focused, the copy command reaches xterm's own copy
// listener, which puts the selection into clipboardData.
async function copySelection(terminal: Terminal) {
  if (await copyLiteral(terminal.getSelection())) return true;
  terminal.focus();
  try { return document.execCommand("copy"); } catch { return false; }
}

/** Runs a menu / shortcut action on one xterm. A failure throws the message the terminal panel shows. */
export async function runTerminalAction(action: TerminalAction, terminal: Terminal) {
  if (action === "selectAll") terminal.selectAll();
  else if (action === "copy") {
    if (terminal.hasSelection() && !(await copySelection(terminal))) throw new Error("复制失败。");
  } else if (action === "paste") {
    let text: string;
    try { text = await navigator.clipboard.readText(); } catch { throw new Error("无法读取剪贴板，请用 Ctrl+Shift+V。"); }
    terminal.paste(text);
  }
  terminal.focus();
}

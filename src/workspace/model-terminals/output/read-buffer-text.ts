import type { Terminal as HeadlessTerminal } from "@xterm/headless";

/** Both ends are xterm buffer positions, not rows in the current viewport. */
export function bufferText(terminal: HeadlessTerminal, start: number, column: number, end: number, endColumn: number): string {
  const buffer = terminal.buffer.active;
  const rows: string[] = [];
  for (let index = Math.max(0, start); index <= end; index++) {
    const line = buffer.getLine(index);
    if (!line) break;
    if (index > start && !line.isWrapped) rows.push("\n");
    rows.push(line.translateToString(true, index === start ? column : 0, index === end ? endColumn : undefined));
  }
  return rows.join("");
}

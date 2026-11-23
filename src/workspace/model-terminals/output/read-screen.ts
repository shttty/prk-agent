import type { ModelTerminal } from "../model-terminals-types.ts";

export function screen(entry: ModelTerminal, tail?: number): string {
  const terminal = entry.terminal;
  const buffer = terminal.buffer.active;
  const rows: string[] = [];
  for (let index = buffer.baseY; index < buffer.baseY + terminal.rows; index++) rows.push(buffer.getLine(index)?.translateToString(true) ?? "");
  const value = rows.join("\n").trimEnd();
  return tail ? value.split("\n").slice(-tail).join("\n") : value;
}

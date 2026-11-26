
/**
 * Parse Pi's edit `details.diff`: lines are `<+|-| ><right-aligned number> <text>`; a context line with a blank number
 * and text `...` marks skipped lines. Returns null when nothing in it looks like that format.
 */
export type DiffRow = { kind: "add" | "del" | "ctx" | "gap"; label: string; text: string };

export function parseDiff(diff: unknown): { rows: DiffRow[]; add: number; del: number; width: number } | null {
  const raw = String(diff).split("\n");
  const numbered = raw.find((line) => /^[+\- ] *\d+ /.test(line));
  if (!numbered) return null;
  const width = (/^.( *\d+) /.exec(numbered)?.[1] ?? "").length;
  const rows: DiffRow[] = [];
  let add = 0;
  let del = 0;
  for (const line of raw) {
    if (!line) continue;
    const sign = line[0];
    const number = line.slice(1, 1 + width).trim();
    const text = line.slice(2 + width).replace(/\r$/, "");
    if (sign === "+") { add += 1; rows.push({ kind: "add", label: `+${number}`, text }); }
    else if (sign === "-") { del += 1; rows.push({ kind: "del", label: `-${number}`, text }); }
    else if (number) rows.push({ kind: "ctx", label: number, text });
    else rows.push({ kind: "gap", label: "…", text: "" });
  }
  return { rows, add, del, width: width + 1 };
}

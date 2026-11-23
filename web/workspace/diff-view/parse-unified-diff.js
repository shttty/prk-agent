
export function parseUnifiedDiff(text) {
  const rows = [];
  let add = 0;
  let del = 0;
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  let hunks = 0;
  for (const line of String(text).split("\n")) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(line);
    if (header) {
      if (hunks > 0) rows.push({ kind: "gap", label: "…", text: "" });
      hunks += 1;
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("diff --git ")) { inHunk = false; continue; }
    if (line.startsWith("\\")) continue; // "\ No newline at end of file"
    const sign = line[0];
    const body = line.slice(1).replace(/\r$/u, "");
    if (sign === "+") { add += 1; rows.push({ kind: "add", label: `+${newLine}`, text: body }); newLine += 1; }
    else if (sign === "-") { del += 1; rows.push({ kind: "del", label: `-${oldLine}`, text: body }); oldLine += 1; }
    else if (sign === " ") { rows.push({ kind: "ctx", label: String(newLine), text: body }); oldLine += 1; newLine += 1; }
  }
  if (!hunks) return null;
  const width = Math.max(...rows.map((row) => row.label.length)) ;
  return { rows, add, del, width };
}

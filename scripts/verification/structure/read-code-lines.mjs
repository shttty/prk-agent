// Effective lines of a source file: no blank lines, no comments (string and template contents are kept as code).
export function readCodeLines(text) {
  const lines = [];
  let current = "";
  let quote = null;
  let inBlock = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];
    if (inBlock) {
      if (char === "*" && next === "/") { inBlock = false; index++; }
      else if (char === "\n") flush();
      continue;
    }
    if (quote) {
      if (char === "\n") { flush(); if (quote !== "`") quote = null; continue; }
      current += char;
      if (char === "\\") current += text[++index] ?? "";
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") { while (index < text.length && text[index] !== "\n") index++; flush(); continue; }
    if (char === "/" && next === "*") { inBlock = true; index++; continue; }
    if (char === "\n") { flush(); continue; }
    if (char === "'" || char === '"' || char === "`") quote = char;
    current += char;
  }
  flush();
  return lines;

  function flush() {
    if (current.trim()) lines.push(current);
    current = "";
  }
}

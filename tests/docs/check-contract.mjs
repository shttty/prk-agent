import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MAX_RULE_CHARS = 100;
const FORBIDDEN = ["因为", "由于", "所以", "目前", "现在", "原型", "待修", "TODO", "以前", "曾经", "历史", "例如", "比如"];
const RULE = /^- `((?:GEN|WEB|KER|TGT|REQ|ORD|LIFE)-[1-9]\d*)` .*?(?:必须|不得).+$/;
const REFERENCE = /\b(?:GEN|WEB|KER|TGT|IF|REQ|ORD|LIFE|PERS|CFG)-[1-9]\d*\b/gi;
const root = fileURLToPath(new URL("../../", import.meta.url));
const content = await readFile(path.join(root, "docs/contract.md"), "utf8");
const lines = content.split("\n");
if (lines.at(-1) === "") lines.pop();
const ids = new Set();
const errors = [];
if (lines.length > 250) errors.push(`contract.md: ${lines.length} lines exceeds 250`);
for (const [index, line] of lines.entries()) {
  for (const word of FORBIDDEN) if (line.includes(word)) errors.push(`contract.md:${index + 1}: forbidden ${word}`);
  if (!line.trim() || /^#{1,2} /.test(line)) continue;
  const match = line.match(RULE);
  if ([...line].length > MAX_RULE_CHARS) errors.push(`contract.md:${index + 1}: rule exceeds ${MAX_RULE_CHARS} characters`);
  if (!match) errors.push(`contract.md:${index + 1}: invalid rule format`);
  else if (ids.has(match[1])) errors.push(`contract.md:${index + 1}: duplicate ${match[1]}`);
  else ids.add(match[1]);
}
if (!ids.size) errors.push("contract.md: no rules");
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name) || entry.isSymbolicLink()) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(?:md|mdx|[cm]?[jt]sx?|py|json|html|css|ya?ml|txt)$/.test(entry.name)) {
      const text = await readFile(file, "utf8");
      for (const match of text.matchAll(REFERENCE)) if (!ids.has(match[0].toUpperCase())) errors.push(`${path.relative(root, file)}: unknown rule ${match[0]}`);
    }
  }
}
for (const dir of ["docs", "src", "web", "tests"]) await scan(path.join(root, dir));
if (errors.length) throw new Error(errors.join("\n"));
console.log(`contract: ${ids.size} unique rules, ${lines.length}/250 lines, references valid`);

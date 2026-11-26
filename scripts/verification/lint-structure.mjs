// Automates AGENTS.md "目录树": effective lines <= 200, at most one exported function per file, no generic names.
// Existing violations are listed per scope in structure-allowlist/<scope>.txt; the lists only shrink: an entry whose
// file no longer breaks the rule (or no longer exists) is an error, so fixed files must be deleted from the list.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { allowlistScope } from "./structure/allowlist-scope.mjs";
import { findFileViolations } from "./structure/find-file-violations.mjs";
import { findUnitUiImports } from "./structure/find-unit-ui-imports.mjs";
import { readAllowlists } from "./structure/read-allowlists.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const CODE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const tracked = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "src", "web", "test", "scripts", "shared"], { cwd: root, encoding: "utf8" })
  .split("\n").filter((file) => file && !file.endsWith("package-lock.json"));
const errors = [];
const found = new Set();
for (const file of tracked) {
  const isCode = CODE.test(file);
  const text = isCode ? await readFile(path.join(root, file), "utf8") : "";
  const rules = isCode ? findFileViolations(file, text) : findFileViolations(file, "").filter((rule) => rule === "name");
  for (const rule of rules) found.add(`${rule} ${file}`);
  if (isCode && file.startsWith("test/unit/")) for (const specifier of findUnitUiImports(text)) errors.push(`${file}: unit tests run under Node and cannot import ${specifier}; move the logic into a JSX-free .ts module`);
}
const listed = new Set();
for (const { scope, rule, file, source } of await readAllowlists(path.join(root, "scripts/verification/structure-allowlist"))) {
  const key = `${rule} ${file}`;
  if (allowlistScope(file) !== scope) errors.push(`${source}: ${file} belongs to ${allowlistScope(file)}.txt`);
  else if (listed.has(key)) errors.push(`${source}: duplicate entry ${key}`);
  else if (!found.has(key)) errors.push(`${source}: ${key} no longer violates; delete the entry`);
  listed.add(key);
}
for (const key of found) {
  if (listed.has(key)) continue;
  const [rule, file] = key.split(" ");
  errors.push(`${file}: breaks "${rule}" (${{ lines: "over 200 effective lines", exports: "2+ exported functions", name: "generic name" }[rule]}); fix it, do not add it to the allowlist`);
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(`structure: ${tracked.length} files, ${listed.size} allowlisted violations`);

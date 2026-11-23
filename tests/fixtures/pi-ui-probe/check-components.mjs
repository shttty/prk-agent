import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tuiIndex = fileURLToPath(import.meta.resolve("@earendil-works/pi-tui")).replace(/\.js$/, ".d.ts");
const agentIndex = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent")).replace(/\.js$/, ".d.ts");

// These indexes contain named re-exports, not executable TypeScript. Compare that
// declaration format directly; TypeScript 7 no longer provides the old JS AST API.
function componentExports(path, moduleMatch) {
  const exports = [...readFileSync(path, "utf8").matchAll(/export\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter(([, , module]) => moduleMatch(module))
    .flatMap(([, names]) => names.split(",").map((name) => name.trim()).filter((name) => name && !name.startsWith("type "))).sort();
  assert.ok(exports.length, `no named component exports found in ${path}`);
  return exports;
}

function tableKeys(name) {
  const source = readFileSync(join(here, "components.ts"), "utf8");
  const body = source.match(new RegExp(`export const ${name} = \\{([^}]+)\\} satisfies`));
  assert.ok(body, `${name} must be a literal coverage table`);
  return [...body[1].matchAll(/^\s*(\w+):\s*"[^"]+"/gm)].map(([, key]) => key).sort();
}

for (const [packageName, index] of [["pi-tui", tuiIndex], ["pi-coding-agent", agentIndex]]) {
  const packageJson = JSON.parse(readFileSync(join(dirname(index), "../package.json"), "utf8"));
  assert.equal(packageJson.version, "1.6.0", `${packageName}: probe only supports Pi 1.6.0`);
}
const tui = componentExports(tuiIndex, (path) => path.startsWith("./components/")).filter((name) => /^[A-Z]/.test(name));
assert.deepEqual(tableKeys("tuiComponentCoverage"), tui, "pi-tui exported component coverage drift");
console.log(`PASS pi-tui components: ${tui.length} (${tui.join(", ")})`);
const pi = componentExports(agentIndex, (path) => path === "./modes/interactive/components/index.ts").filter((name) => /^[A-Z]/.test(name));
assert.deepEqual(tableKeys("piComponentCoverage"), pi, "Pi interactive component coverage drift");
console.log(`PASS Pi interactive components: ${pi.length} (${pi.join(", ")})`);

// Actual npm tarballs and the production Gateway builder; classification must never import a fixture.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

const root = await mkdtemp(join(tmpdir(), "prk-extension-location-"));
initializePrkHome(root);
const { ArtifactStore } = await import("../../src/artifacts/store/assemble-store.ts");
const { buildRemoteExtensionPackage } = await import("../../src/remote-extensions/bundle/build-extension-package.ts");
const { extractRemoteExtensionBundle } = await import("../../src/remote-extensions/bundle/extract-bundle.ts");
const { resolveExtensionLocation } = await import("../../src/remote-extensions/packages/resolve-location.ts");
const run = promisify(execFile);
const imported = "__prkLocationFixtureImported";
const mustNotExecute = `globalThis[${JSON.stringify(imported)}] = true; throw new Error("Location classification imported extension code");\n`;
const ui = 'export default function(pi) { pi.on("session_start", (_event, ctx) => ctx.ui.setStatus("fixture", "ready")); }\n';
const toolCall = 'export default function(pi) { pi.on(\n  "tool_call", () => undefined); }\n';
const definitions = [
  { key: "tool-call", files: { "index.ts": toolCall }, expected: "target" },
  { key: "tool-result", files: { "index.ts": 'export default function(pi) { pi["on"]("tool_result", () => undefined); }\n' }, expected: "target" },
  { key: "fs", files: { "index.ts": ui, "lib/files.cts": 'import fs = require("fs");\nexport const read = fs.readFileSync;\n' }, expected: "target" },
  { key: "child-process", files: { "index.ts": ui, "lib/process.mjs": 'export const load = () => import("node:child_process");\n' }, expected: "target" },
  { key: "ui", files: { "index.ts": ui, "types.d.ts": 'import "node:fs";\n' }, bundled: true, expected: "local" },
  { key: "explicit-local", files: { "index.ts": toolCall, "lib/files.js": 'import "node:fs/promises";\n' }, location: "local", expected: "local" },
  { key: "explicit-target", files: { "index.ts": ui }, location: "target", expected: "target" },
  { key: "explicit-priority", files: { "index.ts": toolCall }, location: ["local", "target"], expected: ["local", "target"] },
];

try {
  const store = new ArtifactStore(join(root, "assets"));
  const archives = join(root, "tarballs");
  await mkdir(archives);
  for (const definition of definitions) {
    const source = join(root, definition.key);
    await mkdir(source);
    const name = `@prk-tests/location-${definition.key}`;
    const dependency = "@prk-tests/location-dependency";
    await writeFile(join(source, "package.json"), JSON.stringify({
      name, version: "1.0.0", private: true, type: "module", files: Object.keys(definition.files),
      pi: { extensions: ["./index.ts"], location: definition.location },
      ...(definition.bundled ? { dependencies: { [dependency]: "1.0.0" }, bundledDependencies: [dependency] } : {}),
    }));
    for (const [file, content] of Object.entries(definition.files)) {
      const path = join(source, file);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, (file === "index.ts" ? mustNotExecute : "") + content);
    }
    if (definition.bundled) {
      const nested = join(source, "node_modules", dependency);
      await mkdir(nested, { recursive: true });
      await writeFile(join(nested, "package.json"), JSON.stringify({ name: dependency, version: "1.0.0", main: "index.js" }));
      await writeFile(join(nested, "index.js"), 'require("node:fs");\n');
    }
    const packed = JSON.parse((await run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", archives], {
      cwd: source, env: { ...process.env, NODE_ENV: "development" }, maxBuffer: 4 * 1024 * 1024,
    })).stdout);
    assert.equal(packed.length, 1);
    const pkg = await buildRemoteExtensionPackage({ store, source: join(archives, packed[0].filename) });
    assert.deepEqual(pkg.location, definition.expected, `${definition.key}: classification is persisted in the built package record`);
    assert.equal(resolveExtensionLocation(pkg, { [name]: "local" }), "local", "User local override wins over metadata/classification");
    assert.equal(resolveExtensionLocation(pkg, { [name]: "target" }), "target", "User target override wins over metadata/classification");
    assert.equal(resolveExtensionLocation(pkg, { [name]: ["target", "local"] }, ["local"]), "local", "Ordered overrides retain platform availability selection");
    assert.equal(globalThis[imported], undefined, "Building/classifying an extension does not import its source");
    if (definition.bundled) {
      const bundle = await extractRemoteExtensionBundle(store.directory, pkg);
      await access(join(bundle, "node_modules", name, "node_modules", dependency, "index.js"));
      assert.equal(resolveExtensionLocation(pkg, {}), "local", "Bundled dependency fs imports and declaration files do not classify a UI package as target");
    }
    if (Array.isArray(definition.location)) {
      assert.equal(resolveExtensionLocation(pkg, {}), "local", "Explicit package priority wins over hook detection");
    }
  }
  console.log("PASS remote extension locations: actual builds persist hook/fs/child_process target and UI local defaults; package/user overrides win; no extension imports");
} finally {
  await rm(root, { recursive: true, force: true });
}

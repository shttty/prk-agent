import test from "node:test";
import assert from "node:assert/strict";
import { parsePluginPackages } from "../../../src/plugins/packages/parse-packages.ts";
import { projectPluginPackages } from "../../../src/plugins/packages/project-packages.ts";
import { convertPackages } from "../../../scripts/plugin-migration/convert-packages.mjs";

test("only unified records load; native resource filters retain their meaning", () => {
  const packages = [{ source: "npm:example", enabled: true, location: "gateway", extensions: ["src/*.ts"], autoload: false },
    { source: "npm:disabled", enabled: false, location: "host" }, { source: "npm:host", enabled: true, location: "host" }];
  assert.deepEqual(parsePluginPackages(packages), packages);
  assert.deepEqual(projectPluginPackages(packages, "gateway"), [{ source: "npm:example", extensions: ["src/*.ts"], autoload: false }]);
  assert.deepEqual(projectPluginPackages(packages).map((pkg) => pkg.source), ["npm:example", "npm:host"]);
  for (const value of [["npm:old"], [{ source: "npm:old" }], [{ ...packages[0], location: ["host", "gateway"] }], [packages[0], packages[0]], [{ ...packages[0], instance: "office" }]]) {
    assert.throws(() => parsePluginPackages(value));
  }
});

test("one-time migration defaults to Gateway and preserves explicit host choice", () => {
  assert.deepEqual(convertPackages(["npm:pi-compaction-recall", "npm:example"], [], {}, "/owned/original"), [
    { source: "npm:pi-compaction-recall", enabled: true, location: "gateway" },
    { source: "npm:example", enabled: true, location: "gateway" },
  ]);
  assert.equal(convertPackages(["npm:lsp"], [], { lsp: "target" }, "/owned/original")[0].location, "host");
  assert.throws(() => convertPackages(["npm:lsp"], [], { lsp: ["target", "local"] }, "/owned/original"), /multiple/);
});

test("legacy artifact identity never implies a registry source", () => {
  const legacy = [{ name: "uploaded", version: "1.0.0", bundle: "owned-artifact" }];
  assert.throws(() => convertPackages([], legacy, {}, "/owned/original"), /no proven original source/);
  assert.equal(convertPackages([], legacy, {}, "/owned/original", { "owned-artifact": "npm:explicit-approved@1.0.0" })[0].source, "npm:explicit-approved@1.0.0");
});

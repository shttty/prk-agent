import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadLayerSettings } from "../../../../src/sessions/memory/layers/load-layer-settings.ts";
import { parseLayerSettings } from "../../../../src/sessions/memory/layers/parse-layer-settings.ts";
import { resolveLayerPath } from "../../../../src/sessions/memory/layers/resolve-layer-path.ts";

function withDirectory(body) {
  const directory = mkdtempSync(join(tmpdir(), "prk-memory-layers-"));
  try { body(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

const layer = (name, extra = "") => `[[layers]]\nname = "${name}"\npath = "~/memories/${name}.md"\ndescription = "${name} layer"\ncapacityCharacters = 4000\n${extra}`;

test("no shared file means the built-in five layers under the configured directory", () => withDirectory((directory) => {
  const settings = loadLayerSettings({ directory, agent: "prk", home: "/home/r" });
  assert.deepEqual(settings.layers.map((item) => [item.name, item.path, item.soft, item.explicitOnly, item.review]), [
    ["control", join(directory, "active_control.md"), true, true, true],
    ["user", join(directory, "user.md"), false, false, true],
    ["memory", join(directory, "notes.md"), false, false, true],
    ["instance", join(directory, "instances/{instance}.md"), false, false, true],
    ["project", join(directory, "projects/{project}/memory.md"), false, false, true],
  ]);
  assert.equal(settings.projectsDirectory, join(directory, "projects"));
  assert.deepEqual(settings.review, { enabled: true, userTurns: 10, toolCalls: 15 });
}));

test("an explicit document without projectsDirectory uses the memory directory; explicit paths keep their meaning", () => {
  const document = { layers: [{ name: "memory", path: "/prk/memories/notes.md", description: "facts", capacityCharacters: 4000 }] };
  assert.equal(parseLayerSettings(document, "/home/r", "/prk/memories").projectsDirectory, "/prk/memories/projects");
  assert.equal(parseLayerSettings({ ...document, projectsDirectory: "~/shared-projects" }, "/home/r", "/prk/memories").projectsDirectory, "/home/r/shared-projects");
  assert.equal(parseLayerSettings({ ...document, projectsDirectory: "/shared/projects" }, "/home/r", "/prk/memories").projectsDirectory, "/shared/projects");
});

test("a host override merges by layer name, keeps the shared order and appends host-only layers", () => withDirectory((directory) => {
  writeFileSync(join(directory, "localmemory.toml"), ["[review]\nuserTurns = 10", layer("control", "soft = true"), layer("user"), layer("memory", "review = true"), layer("instance", "review = true")].join("\n"));
  writeFileSync(join(directory, "prk-localmemory-override.toml"), [
    "[review]\nuserTurns = 5",
    '[[layers]]\nname = "instance"\nenabled = false',
    '[[layers]]\nname = "memory"\ncapacityCharacters = 3000',
    layer("prk", "review = true"),
    '[[layers]]\nname = "control"\nenabled = true',
  ].join("\n"));
  const prk = loadLayerSettings({ directory, agent: "prk", home: "/home/r" });
  assert.deepEqual(prk.layers.map((item) => `${item.name}:${item.capacityCharacters}`), ["control:4000", "user:4000", "memory:3000", "prk:4000"]);
  assert.equal(prk.layers[2].review, true);
  assert.equal(prk.layers[0].soft, true);
  assert.deepEqual(prk.review, { enabled: true, userTurns: 5, toolCalls: 15 });
  const other = loadLayerSettings({ directory, agent: "omp", home: "/home/r" });
  assert.deepEqual(other.layers.map((item) => item.name), ["control", "user", "memory", "instance"]);
}));

test("malformed TOML names the file", () => withDirectory((directory) => {
  writeFileSync(join(directory, "localmemory.toml"), "layers = [\n");
  assert.throws(() => loadLayerSettings({ directory, agent: "prk", home: "/home/r" }), /localmemory\.toml/);
}));

for (const [name, document, pattern] of [
  ["unknown top-level key", { layers: [{ name: "a", path: "/a", description: "d", capacityCharacters: 1 }], extra: 1 }, /Unknown key config\.extra/],
  ["unknown layer key", { layers: [{ name: "a", path: "/a", description: "d", capacityCharacters: 1, size: 3 }] }, /Unknown key layers\[0\]\.size/],
  ["empty layers", { layers: [] }, /non-empty list/],
  ["relative path", { layers: [{ name: "a", path: "notes.md", description: "d", capacityCharacters: 1 }] }, /absolute/],
  ["unknown path variable", { layers: [{ name: "a", path: "/m/{session}.md", description: "d", capacityCharacters: 1 }] }, /unknown \{session\}/],
  ["bad layer name", { layers: [{ name: "A b", path: "/a", description: "d", capacityCharacters: 1 }] }, /name must match/],
  ["duplicate layer", { layers: [{ name: "a", path: "/a", description: "d", capacityCharacters: 1 }, { name: "a", path: "/b", description: "d", capacityCharacters: 1 }] }, /Duplicate layer name a/],
  ["zero capacity", { layers: [{ name: "a", path: "/a", description: "d", capacityCharacters: 0 }] }, /capacityCharacters/],
  ["soft not boolean", { layers: [{ name: "a", path: "/a", description: "d", capacityCharacters: 1, soft: "yes" }] }, /soft must be true or false/],
  ["unknown review key", { layers: [{ name: "a", path: "/a", description: "d", capacityCharacters: 1 }], review: { turnThreshold: 3 } }, /Unknown key review\.turnThreshold/],
  ["zero review turns", { layers: [{ name: "a", path: "/a", description: "d", capacityCharacters: 1 }], review: { userTurns: 0 } }, /review\.userTurns/],
  ["zero review tool calls", { layers: [{ name: "a", path: "/a", description: "d", capacityCharacters: 1 }], review: { toolCalls: 0 } }, /review\.toolCalls/],
]) {
  test(`invalid layer settings are refused: ${name}`, () => {
    assert.throws(() => parseLayerSettings(document, "/home/r", "/prk/memories"), pattern);
  });
}

test("layer paths resolve the session's instance and project; a project layer without a project is absent", () => {
  const [, , , instance, project] = loadLayerSettings({ directory: "/nonexistent", agent: "prk", home: "/home/r" }).layers;
  assert.equal(resolveLayerPath(instance, { instance: "gpu-box" }), "/nonexistent/instances/gpu-box.md");
  assert.equal(resolveLayerPath(project, { instance: "gpu-box" }), undefined);
  assert.equal(resolveLayerPath(project, { instance: "gpu-box", project: "project-1" }), "/nonexistent/projects/project-1/memory.md");
  assert.equal(resolveLayerPath(instance, { instance: "机房 A" }), "/nonexistent/instances/机房 A.md");
  assert.throws(() => resolveLayerPath(instance, { instance: "../etc" }), /one path segment/);
  assert.throws(() => resolveLayerPath(instance, { instance: ".." }), /one path segment/);
  assert.throws(() => resolveLayerPath(project, { instance: "a", project: "x/y" }), /one path segment/);
});

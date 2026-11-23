import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MemoryStore } from "../../../../src/sessions/memory/assemble-memory.ts";

function withStore(body) {
  const directory = mkdtempSync(join(tmpdir(), "prk-memory-config-"));
  try { body(new MemoryStore({ directory, enabled: true }), directory); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

const sharedDocument = (directory) => ({
  review: { userTurns: 10, toolCalls: 15 },
  layers: [
    { name: "control", path: `${directory}/control.md`, description: "rules", capacityCharacters: 4000, soft: true, explicitOnly: true },
    { name: "user", path: `${directory}/user.md`, description: "user facts", capacityCharacters: 4000, review: true },
  ],
});

test("an absent file saves with an empty hash and round-trips as TOML the store reads", () => withStore((store, directory) => {
  const empty = store.config("shared");
  assert.deepEqual([empty.exists, empty.hash, empty.document], [false, "", null]);
  const saved = store.saveConfig("shared", sharedDocument(directory), "");
  assert.equal(saved.exists, true);
  assert.match(readFileSync(join(directory, "localmemory.toml"), "utf8"), /^# Shared memory layers[^]*\[\[layers\]\]\nname = "control"/);
  assert.deepEqual(store.settings().layers.map((layer) => layer.name), ["control", "user"]);
  assert.deepEqual({ ...saved.document.layers[1] }, sharedDocument(directory).layers[1]);
}));

test("a stale hash is refused and leaves the file alone", () => withStore((store, directory) => {
  const first = store.saveConfig("shared", sharedDocument(directory), "");
  writeFileSync(join(directory, "localmemory.toml"), first.raw + "\n# edited elsewhere\n");
  assert.throws(() => store.saveConfig("shared", { ...sharedDocument(directory), review: { userTurns: 3 } }, first.hash), (error) => error.code === "CONFLICT");
  assert.match(readFileSync(join(directory, "localmemory.toml"), "utf8"), /edited elsewhere/);
}));

test("documents that would not parse are refused, including overrides that break the merge", () => withStore((store, directory) => {
  const shared = store.saveConfig("shared", sharedDocument(directory), "");
  assert.throws(() => store.saveConfig("shared", { layers: [{ name: "x", path: "relative.md", description: "d", capacityCharacters: 1 }] }, shared.hash), /not saved: .*absolute/);
  assert.throws(() => store.saveConfig("override", { layers: [{ name: "user", capacityCharacters: 0 }] }, ""), /not saved: .*capacityCharacters/);
  const override = store.saveConfig("override", { layers: [{ name: "user", enabled: false }] }, "");
  assert.equal(override.path, join(directory, "prk-localmemory-override.toml"));
  assert.deepEqual(store.settings().layers.map((layer) => layer.name), ["control"]);
  assert.throws(() => store.saveConfig("shared", { layers: [{ name: "user", path: `${directory}/user.md`, description: "u", capacityCharacters: 1 }] }, store.config("shared").hash), /not saved/, "a shared edit that leaves PRK with no layers is refused");
}));

test("an unparseable file is shown with its error and can be replaced", () => withStore((store, directory) => {
  writeFileSync(join(directory, "localmemory.toml"), "layers = [\n");
  const broken = store.config("shared");
  assert.equal(broken.document, null);
  assert.match(broken.error, /\S/);
  store.saveConfig("shared", sharedDocument(directory), broken.hash);
  assert.deepEqual(store.settings().layers.map((layer) => layer.name), ["control", "user"]);
}));

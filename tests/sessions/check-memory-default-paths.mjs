import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { MemoryStore } from "../../src/sessions/memory/assemble-memory.ts";

const root = mkdtempSync(join(tmpdir(), "prk-memory-default-"));
const environment = Object.fromEntries(["PRK_HOME", "PRK_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR"].map((key) => [key, process.env[key]]));
try {
  process.env.PRK_HOME = root;
  const paths = initializePrkHome();
  const config = parsePrkConfig({});
  const directory = resolve(paths.home, config.memory.directory);
  assert.equal(directory, join(root, "memories"));
  const store = new MemoryStore({ directory, enabled: config.memory.enabled });
  assert.equal(existsSync(join(directory, "localmemory.toml")), false);
  const settings = store.settings();
  // Check every destination before any operation can read or write memory files, including on the red run.
  for (const path of [settings.projectsDirectory, ...settings.layers.map((layer) => layer.path)]) {
    const within = relative(directory, path);
    assert(isAbsolute(path) && within !== ".." && !within.startsWith(`..${sep}`) && !isAbsolute(within), `memory destination escaped PRK_HOME: ${path}`);
    assert(!path.startsWith(join(homedir(), "memories") + sep), "default destination must not use real HOME memories");
  }
  const scope = { instance: "fixture", project: "project-default-paths", projectName: "Isolated default project" };
  store.apply({ target: "memory", action: "add", content: "Default notes stay in the isolated PRK home." },
    { ...scope, sessionId: "default-paths", source: "model" });
  store.registerProject(scope.project, scope.projectName, "2025-01-02T03:04:05.000Z");
  assert.equal(readFileSync(join(directory, "notes.md"), "utf8"), "Default notes stay in the isolated PRK home.");
  const project = JSON.parse(readFileSync(join(directory, "projects/project-default-paths/project.json"), "utf8"));
  assert.equal(project.id, scope.project);
  assert.equal(project.name, scope.projectName);

  // Saving an override before a shared file must validate against the same directory-bound defaults.
  store.saveConfig("override", { layers: [{ name: "memory", capacityCharacters: 3000 }] }, "");
  assert.equal(store.settings().layers.find((layer) => layer.name === "memory").capacityCharacters, 3000);
  const saved = store.saveConfig("shared", { ...settings }, "");
  assert.equal(saved.document.projectsDirectory, join(directory, "projects"));
  assert.deepEqual(saved.document.layers.map((layer) => layer.path), settings.layers.map((layer) => layer.path));
  assert.equal(store.settings().layers.find((layer) => layer.name === "memory").path, join(directory, "notes.md"));
  // A real shared TOML document may omit projectsDirectory; check its destination before project IO too.
  const explicit = store.saveConfig("shared", { layers: saved.document.layers }, saved.hash);
  assert.equal(Object.hasOwn(explicit.document, "projectsDirectory"), false);
  assert.equal(store.settings().projectsDirectory, join(directory, "projects"));
  const explicitScope = { instance: "fixture", project: "project-explicit-toml", projectName: "Explicit TOML project" };
  store.registerProject(explicitScope.project, explicitScope.projectName, "2025-01-02T03:04:05.000Z");
  const explicitProject = JSON.parse(readFileSync(join(directory, "projects/project-explicit-toml/project.json"), "utf8"));
  assert.equal(explicitProject.id, explicitScope.project);
  assert.equal(explicitProject.name, explicitScope.projectName);
  console.log("memory default paths: PASS (isolated PRK_HOME, add, project registration, first config save, explicit TOML project fallback)");
} finally {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
}

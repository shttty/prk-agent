import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MemoryStore } from "../../../../src/sessions/memory/assemble-memory.ts";
import { observeSettled } from "../../../../src/sessions/memory-review/observe-settled.ts";

const layer = (name, path, extra = "") => `[[layers]]\nname = "${name}"\npath = "${path}"\ndescription = "${name} facts"\ncapacityCharacters = 20\n${extra}`;

function withStore(body) {
  const directory = mkdtempSync(join(tmpdir(), "prk-memory-store-"));
  writeFileSync(join(directory, "localmemory.toml"), [
    `projectsDirectory = "${directory}/projects"`,
    layer("control", `${directory}/control.md`, "soft = true\nexplicitOnly = true"),
    layer("user", `${directory}/user.md`),
    layer("instance", `${directory}/instances/{instance}.md`, "review = true"),
    layer("project", `${directory}/projects/{project}/memory.md`, "review = true"),
  ].join("\n"));
  try { body(new MemoryStore({ directory, enabled: true }), directory); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

const human = (extra = {}) => ({ sessionId: "s", source: "human", instance: "alpha", ...extra });

test("writes land in the scoped layer files; soft layers remind, hard layers refuse the whole batch", () => withStore((store, directory) => {
  store.apply({ operations: [{ target: "user", action: "add", content: "user-note" }, { target: "instance", action: "add", content: "gpu" }] }, human());
  assert.equal(readFileSync(join(directory, "user.md"), "utf8"), "user-note");
  assert.equal(readFileSync(join(directory, "instances/alpha.md"), "utf8"), "gpu");
  const soft = store.apply({ target: "control", action: "add", content: "x".repeat(30) }, human());
  assert.match(soft.message, /control exceeds its recommended size/);
  assert.throws(() => store.apply({ operations: [{ target: "user", action: "add", content: "keep-out" }, { target: "instance", action: "add", content: "y".repeat(30) }] }, human()), /hard limit/);
  assert.equal(readFileSync(join(directory, "user.md"), "utf8"), "user-note");
  assert.throws(() => store.apply({ target: "project", action: "add", content: "p" }, human()), /needs a project/);
  store.apply({ target: "project", action: "add", content: "p" }, human({ project: "project-1" }));
  assert.equal(readFileSync(join(directory, "projects/project-1/memory.md"), "utf8"), "p");
  assert.throws(() => store.apply({ target: "nope", action: "add", content: "x" }, human()), /Configured layers: control, user, instance, project/);
  assert.throws(() => store.apply({ target: "user", action: "add", content: "x" }, { ...human(), source: "review" }), /may not write "user"/);
}));

test("render follows configured order, skips an unscoped project layer and never writes project records", () => withStore((store, directory) => {
  store.apply({ operations: [{ target: "user", action: "add", content: "U" }, { target: "control", action: "add", content: "C" }] }, human());
  store.apply({ target: "project", action: "add", content: "P" }, human({ project: "project-1" }));
  const plain = store.render({ instance: "alpha" });
  assert(plain.indexOf("CONTROL") < plain.indexOf("USER"));
  assert(!plain.includes("PROJECT"));
  const scoped = store.render({ instance: "alpha", project: "project-1", projectName: "运维" });
  assert.match(scoped, /PROJECT — 运维/);
  assert.throws(() => readFileSync(join(directory, "projects/project-1/project.json")), { code: "ENOENT" });
  store.registerProject("project-1", "运维", "2025-01-02T03:04:05.000Z");
  const record = JSON.parse(readFileSync(join(directory, "projects/project-1/project.json"), "utf8"));
  assert.deepEqual([record.id, record.name, record.archived], ["project-1", "运维", false]);
  writeFileSync(join(directory, "projects/project-1/project.json"), JSON.stringify({ ...record, name: "改名后" }));
  store.render({ instance: "alpha", project: "project-1", projectName: "运维" });
  assert.equal(JSON.parse(readFileSync(join(directory, "projects/project-1/project.json"), "utf8")).name, "改名后", "an existing record is never overwritten");
}));

test("list covers every layer: instances configured or retained, projects from the registry", () => withStore((store, directory) => {
  mkdirSync(join(directory, "instances"), { recursive: true });
  writeFileSync(join(directory, "instances/gone.md"), "old");
  store.registerProject("project-1", "运维", "2025-01-02T03:04:05.000Z");
  const listing = store.list(["alpha"]);
  assert.deepEqual(listing.layers.map((item) => `${item.name}:${item.scope}`), ["control:none", "user:none", "instance:instance", "project:project"]);
  assert.deepEqual(listing.memories.map((item) => [item.target, item.instance ?? item.project ?? "", Boolean(item.deleted)]), [
    ["control", "", false], ["user", "", false], ["instance", "alpha", false], ["instance", "gone", true], ["project", "project-1", false],
  ]);
  assert.equal(listing.memories.at(-1).projectName, "运维");
  writeFileSync(join(directory, "localmemory.toml"), "layers = [\n");
  const broken = store.list(["alpha"]);
  assert.equal(broken.enabled, false);
  assert.match(broken.error, /localmemory\.toml/);
  assert.equal(store.render({ instance: "alpha" }), "");
}));

test("review starts after a settled reply once either user turns or tool calls reach their threshold", () => {
  const ctx = { session: { model: undefined }, store: {}, scope: {}, thresholds: { userTurns: 3, toolCalls: 2 }, turns: 0, toolCalls: 0, closed: false };
  observeSettled(ctx, { type: "tool_execution_end" });
  observeSettled(ctx, { type: "agent_settled", aborted: false });
  assert.deepEqual([ctx.turns, ctx.toolCalls], [0, 1], "below both thresholds nothing starts");
  observeSettled(ctx, { type: "tool_execution_end" });
  observeSettled(ctx, { type: "agent_settled", aborted: true });
  assert.equal(ctx.toolCalls, 2, "an aborted reply never triggers review");
  observeSettled(ctx, { type: "agent_settled", aborted: false });
  assert.deepEqual([ctx.turns, ctx.toolCalls], [0, 0], "tool calls alone trigger and reset both counters");
  ctx.turns = 3;
  observeSettled(ctx, { type: "agent_settled", aborted: false });
  assert.deepEqual([ctx.turns, ctx.toolCalls], [0, 0], "user turns alone trigger too");
});

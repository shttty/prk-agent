import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse, stringify } from "smol-toml";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { planMigration } from "../../scripts/pienv-migration/plan-migration.mjs";
import { applyMigration } from "../../scripts/pienv-migration/apply-migration.mjs";
import { loadRecord } from "../../src/sessions/history/catalog/load-record.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../src/config/limits/limits-options.ts";

const root = mkdtempSync(join(tmpdir(), "prk-migrate-"));
try {
  const specs = join(root, "specs");
  for (const [name, python] of [["prk-python", "/owned/python"], ["alias", "/owned/python"], ["other", "/other/python"]]) {
    mkdirSync(join(specs, name), { recursive: true });
    writeFileSync(join(specs, name, "kernel.json"), JSON.stringify({ argv: [python, "-m", "ipykernel_launcher"] }));
  }
  const scenarios = ["good", "duplicate", "foreign", "bad-branch", "conflict", "missing-spec", "unreadable-spec", "write-conflict", "partial", "staging", "fork"];
  const selected = process.argv[2];
  assert(selected === undefined || scenarios.includes(selected), "Unknown migration scenario");
  for (const scenario of selected ? [selected] : scenarios) {
    const home = join(root, scenario);
    const sessions = join(home, "sessions");
    mkdirSync(sessions, { recursive: true });
    const sessionId = randomUUID(), ancestor = randomUUID();
    const timestamp = "2026-11-18T00:00:00.000Z";
    const binding = { version: 3, sessionId, target: "local", cwd: "/owned", kernelName: "prk-python" };
    const entries = [
      { type: "session", version: 3, id: sessionId, cwd: "/owned", timestamp, ...(scenario === "fork" ? { parentSession: "/owned/ancestor.jsonl" } : {}) },
      { type: "custom", id: "creation", parentId: null, timestamp, customType: "gateway-session-binding", data: { ...binding, ...(scenario === "foreign" || scenario === "fork" ? { sessionId: ancestor } : {}) } },
      { type: "session_info", id: "title", parentId: "creation", timestamp, name: "Owned migration" },
      { type: "custom", id: "branch", parentId: "creation", timestamp, customType: "gateway-session-retarget", data: { ...binding, version: 1, kernelName: scenario === "conflict" ? "other" : scenario === "missing-spec" ? "missing" : "alias", ...(scenario === "bad-branch" ? { cwd: "relative" } : {}) } },
      { type: "custom", id: "leaf", parentId: "title", timestamp, customType: "gateway-session-retarget", data: { ...binding, version: 1, target: "removed-target" } },
      { type: "message", id: "content", parentId: "leaf", timestamp, message: { role: "user", content: "Keep exact SDK content", timestamp: 1 } },
    ];
    if (scenario === "duplicate") entries.push({ ...entries[1], id: "duplicate", parentId: "content" });
    if (scenario === "fork") entries.push({ ...entries[1], id: "fork-binding", parentId: "content", data: binding });
    const history = join(sessions, `${sessionId}.jsonl`);
    const original = entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
    writeFileSync(history, original);
    writeFileSync(join(home, "config.toml"), stringify({ monitor: { slowIntervalMs: 32100, idleExitMs: 12345, restartBackoffMs: 12, restartBackoffMaxMs: 34, restartAttemptsMax: 2, startTimeoutMs: 45678 }, jupyter: { startTimeoutMs: 56789, requestTimeoutMs: 67890 } }));
    writeFileSync(join(home, "instances.toml"), stringify({ instances: [{ name: "local", label: "Local", local: true, cwd: "/owned", url: "http://127.0.0.1:1/", token: "fixture-only", defaultKernelName: "prk-python" }] }));
    if (["duplicate", "foreign", "bad-branch", "conflict"].includes(scenario)) {
      assert.throws(() => planMigration(home, specs), scenario === "duplicate" ? /duplicate/ : scenario === "foreign" ? /identity/ : scenario === "bad-branch" ? /cwd/ : /local.*prk-python.*\/owned\/python.*other.*\/other\/python/);
      assert.equal(readFileSync(history, "utf8"), original);
      assert(!existsSync(join(home, "before-pienv")), "Invalid metadata is rejected before backup or writes");
      continue;
    }
    let plan;
    const blockedSpec = join(specs, "prk-python", "kernel.json");
    if (scenario === "unreadable-spec") chmodSync(blockedSpec, 0);
    try {
      if (scenario === "unreadable-spec") assert.throws(() => readFileSync(blockedSpec, "utf8"), { code: "EACCES" }, "Exercise an actual filesystem permission denial");
      plan = planMigration(home, specs);
    } finally { if (scenario === "unreadable-spec") chmodSync(blockedSpec, 0o600); }
    if (scenario === "write-conflict") {
      writeFileSync(history, original + "\n");
      assert.throws(() => applyMigration(plan), /No files replaced.*No backup was created/);
      assert.equal(readFileSync(history, "utf8"), original + "\n");
      assert(!existsSync(join(home, "before-pienv")));
      assert(!readdirSync(sessions).some((name) => name.endsWith(".tmp")));
      continue;
    }
    if (scenario === "staging") {
      plan.changes.push({ path: join(home, "missing", "file"), text: "fail", mode: 0o666 });
      assert.throws(() => applyMigration(plan), /No files replaced.*No backup was created/);
      assert.equal(readFileSync(history, "utf8"), original);
      continue;
    }
    if (scenario === "partial") {
      plan.changes.push({ path: join(home, "missing-file"), remove: true });
      assert.throws(() => applyMigration(plan), /Restore .*before-pienv.*Replaced:/);
      assert.equal(readFileSync(join(home, "before-pienv", "sessions", `${sessionId}.jsonl`), "utf8"), original);
      assert.notEqual(readFileSync(history, "utf8"), original);
      continue;
    }
    const result = applyMigration(plan);
    assert.equal(result.unchanged, false);
    assert.equal(statSync(join(home, "instances.toml")).mode & 0o777, 0o600);
    const config = parse(readFileSync(join(home, "config.toml"), "utf8"));
    assert.equal(config.monitor.slowIntervalMs, 32100);
    assert.equal(config.targetConnection.startTimeoutMs, 45678);
    assert.equal(config.targetConnection.requestTimeoutMs, 67890);
    assert.equal(config.kernel.startTimeoutMs, 56789);
    assert.deepEqual(Object.keys(config.monitor), ["slowIntervalMs"]);
    const instance = parse(readFileSync(join(home, "instances.toml"), "utf8")).instances[0];
    assert.equal(instance.id, "local");
    assert.equal(Object.hasOwn(instance, "name"), false);
    assert.equal(instance.python, ["missing-spec", "unreadable-spec"].includes(scenario) ? undefined : "/owned/python");
    const converted = readFileSync(history, "utf8").trim().split("\n").map(JSON.parse);
    assert.deepEqual(converted.map(({ data, ...envelope }) => envelope), entries.map(({ data, ...envelope }) => envelope));
    const manager = SessionManager.open(history, sessions);
    assert(loadRecord(manager, history, sessionId, sessions, DEFAULT_LIMITS_OPTIONS), "New Gateway history authority can read the migrated session without execution");
    const bytes = readFileSync(history, "utf8");
    assert.equal(applyMigration(planMigration(home, specs)).unchanged, true);
    assert.equal(readFileSync(history, "utf8"), bytes);
  }
  console.log(`PASS PIENV migration scenarios: ${selected ?? scenarios.join(", ")}`);
} finally { rmSync(root, { recursive: true, force: true }); }

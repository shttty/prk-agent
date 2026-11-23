import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTargetEnvironments } from "../../../src/target-environment/connection/assemble-environments.ts";
import { createPtyTerminals } from "../../../src/workspace/pty-terminals/assemble-terminals.ts";
import { DEFAULT_WORKSPACE_OPTIONS } from "../../../src/config/workspace/workspace-options.ts";
import { createModelBashCommand } from "../../../src/workspace/terminals/shell/model-bash.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { workspace } from "../../../src/gateway/workspace/execute-workspace-request.ts";
import { WireError } from "../../../src/gateway/wire/create-error.ts";
import { connectWebGateway } from "../../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../../src/http/listener/start-listener.ts";
import { createAppHost } from "./create-app-host.mjs";
import { createModelTerminals } from "../../../src/workspace/model-terminals/create-terminals.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../../src/config/terminal/terminal-options.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../../src/config/limits/limits-options.ts";
import { DEFAULT_HTTP_OPTIONS } from "../../../src/config/http/http-options.ts";
import { assembleFiles } from "../../../src/workspace/target-files/assemble-files.ts";
import { DEFAULT_REFERENCES_OPTIONS } from "../../../src/config/references/references-options.ts";
import { DEFAULT_TARGET_CONNECTION_OPTIONS } from "../../../src/config/target-connection/target-connection-options.ts";

/** Real candidate composition: no replacement protocol handlers, synthetic output or cleanup stubs. */
export async function createPtyBrowserFixture({ log = (value) => console.log(JSON.stringify(value)), http, idleTimeoutMs, firstSessionMessages } = {}) {
  assert.equal(process.env.JUPYTER_URL, undefined);
  assert.equal(process.env.JUPYTER_TOKEN, undefined);
  const root = await mkdtemp(join(tmpdir(), "prk-S3-web-"));
  const previous = { HOME: process.env.HOME, PRK_HOME: process.env.PRK_HOME };
  process.env.HOME = root;
  process.env.PRK_HOME = join(root, "prk");
  await mkdir(process.env.PRK_HOME);
  let nativeHost, listener, adapter, web;
  const python = process.env.PI_TEST_PYTHON ?? "/usr/bin/python3";
  const leases = [], events = [], identities = [];
  const modelControllers = new Map();
  const environments = createTargetEnvironments({ resolve: () => ({ local: true }), onEvent: (_, event) => { events.push(event); log({ environment: event }); } });
  const files = assembleFiles({ environments, workspace: DEFAULT_WORKSPACE_OPTIONS, references: DEFAULT_REFERENCES_OPTIONS, targetConnection: DEFAULT_TARGET_CONNECTION_OPTIONS });
  const acquire = async (id = "owned") => { const lease = await environments.acquire(id); leases.push(lease); return lease; };
  const terminals = createPtyTerminals({
    workspace: DEFAULT_WORKSPACE_OPTIONS,
    runtime: async () => ({ python, basePython: python, env: {} }),
    ownerTarget: (id) => nativeHost?.workbench().sessions.find((session) => session.sessionId === id)?.target,
    acquire,
    onCleanupUnknown: (error, sessionId, name) => log({ cleanupUnknown: String(error), sessionId, name }),
  });
  const context = (id) => {
    const selected = nativeHost.workbench().sessions.find((session) => session.sessionId === id);
    if (!selected) throw new WireError("NOT_FOUND", "Unknown owned session.");
    return selected;
  };
  async function until(read, label) {
    for (let i = 0; i < 500; i++) { const value = await read(); if (value) return value; await delay(20); }
    throw new Error(`PTY browser fixture timed out: ${label}`);
  }
  async function recordIdentity(id, name, snapshot) {
    if (identities.some((entry) => entry.generation === snapshot.generation)) return;
    await terminals.integration(id, name);
    const file = join(root, `pid-${randomUUID()}`);
    terminals.input(id, name, `printf '%s' "$$" > '${file}'\r`);
    const pid = Number(await until(() => readFile(file, "utf8").catch(() => ""), "shell PID"));
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    const identity = { sessionId: id, name, generation: snapshot.generation, pid, start: fields[19], pgid: Number(fields[2]), sid: Number(fields[3]) };
    identities.push(identity); log({ identity });
  }
  const ctx = { workspace: { terminals, files, modelTerminals: modelControllers }, methods: { storedSession: context, workspaceContext: context, runtimeChange: (run) => run() } };
  let cleaned = false;
  async function cleanupOwnedShells() {
    if (cleaned) return;
    cleaned = true;
    try {
      const failures = [];
      for (const close of [() => Promise.all([...modelControllers.values()].map((model) => model.closeAll())), () => terminals.shutdown(), () => nativeHost?.close()]) {
        try { await close(); } catch (error) { failures.push(error); }
      }
      // Test-owner fallback only: signal recorded PID after starttime verification, never scan sessions.
      for (const identity of identities) {
        const stat = await readFile(`/proc/${identity.pid}/stat`, "utf8").catch(() => "");
        if (stat && stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] === identity.start) process.kill(identity.pid, "SIGKILL");
      }
      await Promise.all(leases.map((lease) => lease.release()));
      for (const identity of identities) {
        await until(async () => !(await readFile(`/proc/${identity.pid}/stat`, "utf8").catch(() => "")), "recorded PID absent");
        log({ recordedPidAbsent: identity.pid, generation: identity.generation });
      }
      if (failures.length) throw new AggregateError(failures, "PTY App fixture cleanup failed.");
    } finally {
      for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      await rm(root, { recursive: true, force: true });
    }
  }
  try {
  nativeHost = await createAppHost(root, python, acquire, { idleTimeoutMs, firstSessionMessages });
  const sessions = nativeHost.workbench().sessions;
  const sampleFile = { path: join(root, "terminal-file.md"), content: "# Terminal workspace\n\nA real file beside a live terminal.\n" };
  await files.create(context(sessions[0].sessionId), { ...sampleFile, type: "file", format: "text" });
  const allowed = new Set(["terminalOpen", "terminalsList", "terminalInput", "terminalResize", "terminalClose", "filesList", "filesRead", "filesWrite", "filesCreate", "filesRename", "filesCopy", "filesDelete"]);
  const host = {
    ...nativeHost,
    subscribeTerminal(id, name, listener) { context(id); return terminals.subscribe(id, name, listener); },
    async workspace(method, id, params) {
      if (!allowed.has(method)) throw new WireError("INVALID_REQUEST", "Outside the PTY and target-files acceptance surface.");
      const result = await workspace(ctx, method, id, params);
      if (method === "terminalOpen") await recordIdentity(id, params.name, result);
      return result;
    },
    async closeSession(id) {
      context(id);
      try { await terminals.closeSession(id); } finally { await nativeHost.closeSession(id); }
    },
    close: cleanupOwnedShells,
  };
  const socket = join(root, "g.sock");
  listener = await startGateway(host, socket);
  adapter = await connectWebGateway({ socket });
  web = await startWebServer(adapter, { port: 0, http: { ...DEFAULT_HTTP_OPTIONS, ...http } });
  return {
    url: web.url, socket, root, sampleFile, sessions: sessions.map(({ sessionId, cwd, target }) => ({ sessionId, cwd, target })), identities,
    async openModel(sessionId, name = "model") {
      const snapshot = await terminals.open(sessionId, context(sessionId), name, { owner: "model", label: name, shellCommand: createModelBashCommand(DEFAULT_TERMINAL_OPTIONS.modelHistoryFile) });
      await recordIdentity(sessionId, name, snapshot);
      return snapshot;
    },
    async runModelCommand(sessionId, input) {
      const target = context(sessionId);
      let model = modelControllers.get(sessionId);
      if (!model) {
        model = createModelTerminals({ sessionId, context: target, terminals, options: DEFAULT_TERMINAL_OPTIONS, limits: DEFAULT_LIMITS_OPTIONS });
        modelControllers.set(sessionId, model);
      }
      const name = input.name ?? "main";
      const before = terminals.list(sessionId).terminals.find((entry) => entry.name === name);
      const result = await model.send(input);
      const after = terminals.list(sessionId).terminals.find((entry) => entry.name === name);
      if (after && after.generation !== before?.generation) await recordIdentity(sessionId, name, after);
      return { result, before, after };
    },
    async exitShell(sessionId, name) {
      context(sessionId); terminals.input(sessionId, name, "exit\r");
      await until(() => !terminals.has(sessionId, name), "natural shell exit");
    },
    closeSession: host.closeSession,
    async disconnectTarget() {
      const spawn = events.findLast((event) => event.kind === "spawn");
      assert.ok(spawn?.wrapperPid);
      log({ killedOwnedWrapper: spawn.wrapperPid });
      process.kill(spawn.wrapperPid, "SIGTERM");
      await until(() => sessions.every(({ sessionId }) => !terminals.list(sessionId).terminals.length), "target retirement");
    },
    async close() { await web.close(); await adapter.close(); await listener.close(); },
  };
  } catch (error) {
    await web?.close(); await adapter?.close();
    if (listener) await listener.close(); else await cleanupOwnedShells();
    throw error;
  }
}

import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// `limits` are per-layer capacities; `reviewTurns` turns background review on with that user-turn threshold.
export async function createMemoryStack({ name, memory = {}, reviewTurns, root, config, limits, provider, runtime, onCleanup, payloads, text, deadline, nextId }) {
  const { createGatewayHost } = await import("../../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../../src/gateway/socket-client/connect-client.ts");
  const { connectWebGateway } = await import("../../../src/http/gateway-connection/connect-gateway.ts");
  const { startWebServer } = await import("../../../src/http/listener/start-listener.ts");
  const { parsePrkConfig } = await import("../../../src/config/document/parse-prk-config.ts");
      const home = join(root, name), localAgentDir = join(home, "agent"), socket = join(home, "gateway.sock");
      await mkdir(home, { mode: 0o700 });
      await mkdir(localAgentDir, { recursive: true });
      await mkdir(join(home, "prompts"));
      await writeFile(join(home, "prompts/soul.md"), "SOUL_FIXTURE_92741\n");
      // The pre-layer file layout, so assertions keep their paths; every layer is reviewable to cover review routing.
      await mkdir(join(home, "memories"));
      const layer = (name, file, limit, extra = "") => `[[layers]]\nname = "${name}"\npath = "${join(home, "memories", file)}"\ndescription = "${name} memory"\ncapacityCharacters = ${limit}\nreview = true\n${extra}`;
      await writeFile(join(home, "memories/localmemory.toml"), [
        `[review]\nuserTurns = ${reviewTurns ?? 1000}\ntoolCalls = 1000`,
        layer("control", "CONTROL.md", limits.control, "soft = true\nexplicitOnly = true"),
        layer("user", "USER.md", limits.user), layer("memory", "MEMORY.md", limits.memory), layer("instance", "instances/{instance}.md", limits.instance),
      ].join("\n"));
      const options = {
        cwd: home, home, historyDir: join(home, "history"), model: "memory-check/primary",
        config: parsePrkConfig({ session: { soulFile: "prompts/soul.md", workerTools: "direct", idleTimeoutMs: 600_000 }, memory: { review: reviewTurns !== undefined, ...memory } }),
        targets: [
          executionTargetFromConfig({ ...config, id: "alpha", label: "alpha", local: true, cwd: root }),
          executionTargetFromConfig({ ...config, id: "beta", label: "beta", local: false, sshCommand: "/bin/sh", cwd: root }),
        ],
      };
      const dependencies = { runtimeDependencies: { model: provider.getModel("primary"), modelRuntime: runtime, thinkingLevel: "off", cwd: home, agentDir: localAgentDir } };
      let host, gateway, client, adapter, web;
      async function stop() {
        const resources = [() => web?.close(), () => adapter?.close(), () => client?.disconnect(), () => gateway ? gateway.close() : host?.close()];
        const failures = [];
        for (const close of resources) { try { await close(); } catch (error) { failures.push(error); } }
        web = adapter = client = gateway = host = undefined;
        if (failures.length) throw new AggregateError(failures, "memory fixture cleanup failed");
      }
      async function start() {
        host = await createGatewayHost(options, dependencies);
        gateway = await startGateway(host, socket);
        client = await connectGateway(socket);
        adapter = await connectWebGateway({ socket });
        web = await startWebServer(adapter, { port: 0 });
      }
      onCleanup(stop);
      await start();
      const post = async (path, body = {}) => {
        const response = await fetch(`${web.url}/api/memory/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
        assert.equal(response.status, 200, await response.clone().text());
        return response.json();
      };
      const action = (worker, action, args = {}) => client.request("nativeAction", { sessionId: worker, requestId: `memory-action-${nextId()}`, action, args });
      const create = async (mode = "direct", target = "alpha") => {
        const worker = (await client.request("createSession", { target })).session.sessionId;
        if (mode !== "direct") assert.equal((await action(worker, "tool-mode", { mode })).status, "completed");
        return worker;
      };
      const row = (worker) => host.workbench().sessions.find(({ sessionId }) => sessionId === worker);
      const notices = (worker, source) => host.state(worker).messages.filter((message) => message.role === "custom" && message.customType === "memory-notice" && (!source || message.details?.source === source));
      async function turn(worker, tool, args, expectError = false, timeoutMs) {
        const id = nextId(), since = payloads.length;
        const admission = await host.nativeSend(worker, { sessionId: worker, requestId: `memory-turn-${id}`, message: `MEMORY_TEST ${JSON.stringify({ id, tool, args })}`, mode: "plain" });
        assert.equal(admission.accepted, true, JSON.stringify(admission));
        assert.equal((await deadline(admission.completion, `turn ${id} completes without human approval`, timeoutMs)).status, "completed");
        const observed = payloads.slice(since).filter((payload) => !payload.review && payload.command?.id === id);
        assert(observed.length > 0, `provider received turn ${id}`);
        const result = tool ? observed.at(-1).messages.findLast((message) => message.role === "toolResult" && message.toolName === tool) : undefined;
        if (tool) { assert(result, `provider received ${tool}'s result`); assert.equal(result.isError, expectError, text(result)); }
        return { ...observed[0], result, final: observed.at(-1), id };
      }
      const memoryCall = (worker, operation, expectError = false) => turn(worker, "memory", operation, expectError);
      const codeCall = (worker, operation, expectError = false) => turn(worker, "kernel_code", { code: `import json\nprint(json.dumps(gateway.memory(**json.loads(${JSON.stringify(JSON.stringify(operation))}))))` }, expectError);
      const file = (target, instance = "alpha") => target === "instance" ? join(home, "memories/instances", `${instance}.md`) : join(home, "memories", `${target.toUpperCase()}.md`);
      const disk = async (target, instance) => { try { return (await readFile(file(target, instance), "utf8")).trim(); } catch (error) { if (error.code === "ENOENT") return ""; throw error; } };
      const manual = async (target, entries, instance) => { await mkdir(join(home, "memories/instances"), { recursive: true }); await writeFile(file(target, instance), entries.join("\n§\n") + (entries.length ? "\n" : "")); };
      return { home, get host() { return host; }, get client() { return client; }, start, stop, post, action, create, row, notices, turn, memoryCall, codeCall, disk, manual };
}

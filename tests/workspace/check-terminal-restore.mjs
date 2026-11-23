import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) throw new Error("Terminal restore check requires test-owned Jupyter Servers.");
process.env.SHELL = "/bin/bash";

await withTargetFixture(async ({ config: office, onCleanup }) => {
  await withTargetFixture(async ({ config: local }) => {
    const root = await mkdtemp(join(tmpdir(), "prk-terminal-restore-"));
    const socket = join(root, "gateway.sock");
    const historyDir = join(root, "history");
    const bindingsFile = join(historyDir, "terminal-bindings.json");
    const instances = [
      { id: "office", label: "Offline after restart", url: office.url, token: office.token, cwd: root, kernel: office.kernelOptions },
      { id: "local", label: "Reachable", url: local.url, token: local.token, cwd: root, kernel: local.kernelOptions },
    ];
    const owners = [];
    let client;
    const redact = (text) => text.replaceAll(office.token, "<REDACTED>").replaceAll(local.token, "<REDACTED>");
    const deadline = (promise, label) => {
      let timer;
      return Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 20000);
      })]).finally(() => clearTimeout(timer));
    };
    onCleanup(async () => {
      client?.disconnect();
      for (const { child, exit } of owners) {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        await exit;
      }
      await rm(root, { recursive: true, force: true });
    });
    async function start() {
      const child = spawn(process.execPath, [fileURLToPath(new URL("../fixtures/recovery-process-fixture.mjs", import.meta.url))], {
        env: { ...process.env, HOME: root, XDG_CONFIG_HOME: join(root, "config"), XDG_CACHE_HOME: join(root, "cache"), XDG_DATA_HOME: join(root, "data") },
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      const exit = once(child, "exit");
      const ready = once(child, "message");
      let stderr = "";
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      const owner = { child, exit, stderr: () => stderr };
      owners.push(owner);
      child.send({ root, historyDir, socket, prkConfig: {}, instancesDocument: { instances } });
      const [message] = await deadline(ready, "Gateway startup");
      assert.equal(message.type, "ready", redact(`${JSON.stringify(message)} ${stderr}`));
      client = await connectGateway(socket);
      return owner;
    }
    async function stop(owner) {
      await client.request("shutdown");
      const [code] = await deadline(owner.exit, "Gateway shutdown");
      client.disconnect();
      assert.equal(code, 0, redact(owner.stderr()));
    }

    const first = await start();
    const sessions = {};
    const initialGenerations = {};
    for (const target of ["office", "local"]) {
      const { session: worker } = await client.request("createSession", { target });
      sessions[target] = worker.sessionId;
      const terminal = await client.request("terminalOpen", { sessionId: worker.sessionId, name: "shell" });
      initialGenerations[target] = terminal.generation;
    }
    await stop(first);
    const bindings = JSON.parse(await readFile(bindingsFile, "utf8"));
    assert.deepEqual(bindings.map(({ target }) => target), ["office", "local"], "The unreachable target precedes the reachable one");
    const port = createServer();
    port.listen(0, "127.0.0.1");
    await once(port, "listening");
    const offlinePort = port.address().port;
    await new Promise((resolve, reject) => port.close((error) => error ? reject(error) : resolve()));
    instances[0].url = `http://127.0.0.1:${offlinePort}/`;

    const restored = await start();
    const snapshot = await client.request("subscribeTerminal", { sessionId: sessions.local, name: "shell" });
    assert.match(snapshot.generation, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    assert.notEqual(snapshot.generation, initialGenerations.local, "Restoration creates a new Gateway terminal incarnation");
    assert.deepEqual(await client.request("terminalsList", { sessionId: sessions.local }), {
      terminals: [{ name: "shell", generation: snapshot.generation, connectionStatus: "connected" }],
    }, "Reachable target is restored despite the first target being offline");
    assert.deepEqual(JSON.parse(await readFile(bindingsFile, "utf8")), bindings, "Both durable bindings survive the offline target");
    assert.equal(snapshot.connectionStatus, "connected");
    let output = "";
    const echoed = Promise.withResolvers();
    client.onTerminalEvent((event) => {
      if (event.type === "stdout") output += event.data.replaceAll("\r", "");
      if (stripVTControlCharacters(output).includes("R1_RESTORED\n")) echoed.resolve();
    });
    await client.request("terminalInput", { sessionId: sessions.local, name: "shell", data: "printf 'R1_%s\\n' RESTORED\r" });
    await deadline(echoed.promise, "restored shell output");
    await stop(restored);
    assert.deepEqual(JSON.parse(await readFile(bindingsFile, "utf8")), bindings, "Shutdown also retains the skipped target binding");
    await assert.rejects(readFile(join(root, "provider-calls")), (error) => error.code === "ENOENT", "No model calls");
    console.log("PASS terminal restore: offline target skipped, Gateway starts, reachable shell accepts input, both bindings retained, zero model calls");
  });
});

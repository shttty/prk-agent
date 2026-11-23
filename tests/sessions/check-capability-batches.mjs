import { parse, stringify } from "smol-toml";
import assert from "node:assert/strict";
import { watch } from "node:fs";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) {
  throw new Error("Capability batch acceptance requires its owned Jupyter fixture; unset JUPYTER_URL and JUPYTER_TOKEN.");
}

const home = await mkdtemp(join(tmpdir(), "prk-batch-"));
const previousHome = process.env.HOME;
process.env.HOME = join(home, "user-home");
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir, { recursive: true });
const { ModelRuntime, SessionManager } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { connectWebGateway } = await import("../../src/http/gateway-connection/connect-gateway.ts");
const { startWebServer } = await import("../../src/http/listener/start-listener.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
try {
  await withTargetFixture(async ({ config, onCleanup }) => {
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "capability-batches", models: [{ id: "controlled" }] });
    modelRuntime.registerNativeProvider(provider.provider);
    const document = { memory: { review: false }, session: { idleTimeoutMs: 60000 } };
    const instances = { instances: [{ ...config, id: "fixture", label: "Fixture", local: true, tags: [], cwd: home }] };
    const configPath = join(home, "config.toml"), instancesPath = join(home, "instances.toml");
    await writeFile(configPath, stringify(document));
    await writeFile(instancesPath, stringify(instances), { mode: 0o600 });
    const host = await createGatewayHost({ cwd: home, home, config: parsePrkConfig(document, instances), model: "capability-batches/controlled" }, {
      runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir },
    });
    const socket = join(home, "batch.sock");
    const endpoint = await startGateway(host, socket);
    onCleanup(() => endpoint.close());
    const client = await connectGateway(socket);
    onCleanup(() => client.disconnect());
    const adapter = await connectWebGateway({ socket });
    onCleanup(() => adapter.close());
    const web = await startWebServer(adapter, { port: 0 });
    onCleanup(() => web.close());
    const worker = (await client.request("createSession", { target: "fixture" })).session.sessionId;
    const stored = (await SessionManager.list(home, join(home, "sessions"))).find(({ id }) => id === host.state(worker).sessionId);
    assert(stored, "The public session listing exposes the real persisted SDK session");
    const native = async (args = {}) => {
      const response = await fetch(`${web.url}/api/sessions/${worker}/native`, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url },
        body: JSON.stringify({ requestId: crypto.randomUUID(), action: "capabilities", args }) });
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    const post = async (body) => {
      const response = await fetch(`${web.url}/api/capabilities`, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    const entries = async () => (await readFile(stored.path, "utf8")).trim().split("\n").map(JSON.parse)
      .filter((entry) => entry.type === "custom" && entry.customType === "gateway-native-session-state");
    const id = "tool:ask", lazyId = "lazy:tool:ask";
    for (const layer of ["global", "instance", "session"]) {
      const instance = layer === "instance" ? { instance: "fixture" } : {};
      const read = async () => layer === "session" ? (await native()).data
        : (await (await fetch(`${web.url}/api/capabilities${layer === "instance" ? "?instance=fixture" : ""}`)).json()).catalog;
      const write = async (changes, success = true) => {
        if (layer === "session") {
          const result = await native({ changes });
          assert.equal(result.status, success ? "completed" : "failed", JSON.stringify(result));
          return result.data;
        }
        const result = await post({ ...instance, changes });
        if (success) assert.equal(result.status, 200, JSON.stringify(result));
        else assert([400, 404].includes(result.status), JSON.stringify(result));
        return result.body.catalog;
      };
      await write([{ id, enabled: false }]);
      const before = await read();
      const bytes = await Promise.all([configPath, instancesPath, stored.path].map((path) => readFile(path, "utf8")));
      for (const invalid of [
        [{ id, enabled: true }, { id: "lazy:tool:kernel_code", enabled: true }],
        [{ id, enabled: true }, { id: "tool:kernel_code", enabled: false }],
        [{ id, enabled: true }, { id: "tool:batch_missing", enabled: false }],
        [], [{ id, enabled: true }, { id, enabled: false }],
      ]) {
        await write(invalid, false);
        assert.deepEqual(await read(), before, `${layer}: rejected batch leaves the catalog unchanged`);
        assert.deepEqual(await Promise.all([configPath, instancesPath, stored.path].map((path) => readFile(path, "utf8"))), bytes, `${layer}: rejected batch leaves all file bytes unchanged`);
      }
      for (const reverse of [false, true]) {
        if (reverse) await write([{ id, enabled: false }]);
        const changes = [{ id, enabled: true }, { id: lazyId, enabled: true }];
        if (reverse) changes.reverse();
        const previousEntries = await entries();
        const replacements = [];
        const watcher = watch(home, (event, file) => { if (event === "rename" && file === (layer === "instance" ? "instances.toml" : "config.toml")) replacements.push(file); });
        let result;
        try { result = await write(changes); await setImmediate(); await setImmediate(); }
        finally { watcher.close(); }
        const entry = result.entries.find((entry) => entry.id === id);
        assert.equal(entry.enabled, true, `${layer}: enabling and lazy-setting accepts either order`);
        assert.equal(entry.lazy.enabled, true);
        assert.equal(entry.lazy.overridden, true);
        if (layer === "session") {
          const saved = await entries();
          assert.equal(saved.length, previousEntries.length + 1, "A multi-entry session batch appends exactly one native state entry");
          assert.deepEqual(saved.at(-1).data.capabilities, { [id]: true, [lazyId]: true });
        } else {
          assert.equal(replacements.length, 1, `${layer}: one atomic file replacement per batch`);
          const saved = structuredClone(parse(await readFile(layer === "global" ? configPath : instancesPath, "utf8")));
          assert.equal((layer === "global" ? saved.session : saved.instances[0]).capabilities[id], true);
          assert.equal((layer === "global" ? saved.session : saved.instances[0]).capabilities[lazyId], true);
        }
        assert.equal((await read()).entries.find((entry) => entry.id === id).lazy.enabled, true);
      }
      await write([{ id, enabled: null }, { id: lazyId, enabled: null }]);
      const reset = (await read()).entries.find((entry) => entry.id === id);
      assert.equal(reset.overridden, false, `${layer}: null clears the enabled override`);
      assert.equal(reset.lazy.overridden, false, `${layer}: null clears the lazy override`);
      assert.equal(reset.enabled, reset.defaultEnabled);
      assert.equal(reset.lazy.enabled, reset.lazy.defaultEnabled);
      if (layer === "session") {
        assert.deepEqual((await entries()).at(-1).data.capabilities, { [id]: null, [lazyId]: null });
        assert.equal((await native({ id, enabled: false })).status, "failed", "The old native write form is rejected");
      } else {
        const saved = structuredClone(parse(await readFile(layer === "global" ? configPath : instancesPath, "utf8")));
        const switches = (layer === "global" ? saved.session : saved.instances[0]).capabilities;
        assert(!Object.hasOwn(switches, id)); assert(!Object.hasOwn(switches, lazyId));
        assert.equal((await post({ ...instance, id, enabled: false })).status, 400, "The old HTTP write form is rejected");
        await assert.rejects(async () => client.request("capabilitiesChange", { ...instance, id, enabled: false }), /Invalid v1 request/);
      }
    }
    const beforeAppendFailure = (await native()).data;
    const sessionBytes = await readFile(stored.path, "utf8");
    await chmod(stored.path, 0o400);
    try {
      const failed = await native({ changes: [{ id, enabled: false }, { id: "group:tools:local", enabled: true }] });
      assert.equal(failed.status, "failed");
      assert.match(failed.message, /EACCES/, "The real SDK append must be the failing operation");
    } finally { await chmod(stored.path, 0o600); }
    assert.equal(await readFile(stored.path, "utf8"), sessionBytes, "A throwing append leaves the JSONL bytes unchanged");
    assert.deepEqual((await native()).data, beforeAppendFailure, "A throwing append leaves both live override maps unchanged");
    assert.equal((await post({ instance: "fixture", changes: [{ id: "group:tools:local", enabled: true }] })).status, 400);
    assert.equal((await post({ terminal: { yieldMs: 17 } })).status, 200, "Terminal writes keep their distinct contract");
    assert.equal(structuredClone(parse(await readFile(configPath, "utf8"))).terminal.yieldMs, 17);
    console.log("PASS real HTTP/wire/SDK capability batches: atomic validation, one persist, enable+lazy in either order, inheritance resets and old-form rejection");
  }, { rootDir: () => home, allowHidden: true });
} finally {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(home, { recursive: true, force: true });
}

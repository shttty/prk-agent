import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "smol-toml";
import { createProbeProvider } from "./create-probe-provider.mjs";
import { measureChild } from "./measure-child.mjs";
import { destroyChild } from "./destroy-child.mjs";

export async function runWorkerScenario({ option, out, smoke, samples, cycles, ns, ms, sleep, until, text, jsonFile }) {
  const scenario = option("--scenario");
  const [targetName, mode, nativeName] = scenario.split("/");
  const native = nativeName === "on";
  const remoteReload = targetName === "remote" && native;
  const root = await mkdtemp(join(tmpdir(), "prk-spawn-bench-"));
  // Set before any Pi/PRK imports. Nothing reads the user's PRK/agent home.
  process.env.HOME = join(root, "gateway-home");
  process.env.XDG_CONFIG_HOME = join(root, "config");
  process.env.XDG_CACHE_HOME = join(root, "cache");
  process.env.XDG_DATA_HOME = join(root, "data");
  process.env.PI_OFFLINE = "1";
  const home = join(root, "prk");
  const cwd = join(root, "workspace");
  await mkdir(process.env.HOME, { recursive: true });
  await mkdir(cwd);
  const { initializePrkHome } = await import("../../../src/config/home/initialize-prk-home.ts");
  const { agentDir, configPath } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  await jsonFile(join(agentDir, "settings.json"), { compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" });
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentSystemPrompt, getCurrentTools } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../../src/gateway/socket-client/connect-client.ts");
  const { parsePrkConfig } = await import("../../../src/config/document/parse-prk-config.ts");
  const { withTargetFixture } = await import("../../../tests/fixtures/target-fixture.mjs");
  const { prepareNativeToolArtifacts } = await import("../../../tests/fixtures/native-tool-artifacts.mjs");
  const { createTargetEnvironments } = await import("../../../src/target-environment/connection/assemble-environments.ts");
  const { executionTargetFromConfig } = await import("../../../src/config/execution-target/from-config.ts");
  const { quoteShell } = await import("../../../src/target-environment/daemon/quote-shell.mjs");
  const { createTargetChannels } = await import("../../../src/target-channel/channels/assemble-channels.ts");
  const { openProcessTransport } = await import("../../../src/target-channel/process-transport/open.ts");
  const data = { scenario, smoke, remoteNativeActivation: remoteReload ? "post-spawn explicit local-tools + reload; not native-on spawn" : "configured default", samples: [], hot: [], retained: [], churn: [] };
  const destination = join(out, scenario.replaceAll("/", "-") + ".json");
  const progress = async (group, row) => {
    data[group].push(row);
    await appendFile(join(out, "progress.jsonl"), JSON.stringify({ scenario, group, ...row }) + "\n");
    await jsonFile(destination, data);
    console.log(`${scenario} ${group} ${row.index}: ${JSON.stringify(row.metrics)}`);
  };
  try {
    if (native) data.artifacts = await prepareNativeToolArtifacts(home);
    if (remoteReload) {
      const { ArtifactStore } = await import("../../../src/artifacts/store/assemble-store.ts");
      const { buildNativeToolHost } = await import("../../../src/remote-extensions/bundle/build-native-tool-host.ts");
      const started = ns();
      data.hostArtifacts = await buildNativeToolHost({ store: new ArtifactStore(join(home, "assets")), platform: { x64: "x86_64", arm64: "aarch64" }[process.arch] });
      data.gatewayBundlePreparationMs = ms(started);
    }
    await withTargetFixture(async (fixture) => {
      const document = { monitor: { enabled: false }, targetConnection: { startTimeoutMs: 30000 }, memory: { reviewInterval: 0 },
        session: { noExtensions: false, bootstrapNoSkills: true, workerTools: mode, localTools: native, idleTimeoutMs: 3600000 },
        targetCacheRoot: join(fixture.tempRoot, "target-cache") };
      await writeFile(configPath, stringify(document));
      const config = parsePrkConfig(document);
      const target = executionTargetFromConfig({ ...fixture.config, id: targetName, label: "Owned shell fixture", local: targetName === "local", tags: [],
        ...(targetName === "local" ? {} : { sshCommand: `HOME=${quoteShell(fixture.tempRoot)} exec /bin/sh` }), remoteExtensions: [], cwd });
      const environments = createTargetEnvironments({ targetCacheRoot: config.targetCacheRoot, resolve: () => target.local ? { local: true } : { local: false, command: target.sshCommand } });
      let active;
      const channels = createTargetChannels({ options: config.targetConnection, async open(_machine, signal, limits) {
        const raw = await openProcessTransport(await environments.acquire(target.id), target.python, target.kernel.cwd, signal, config.targetConnection.startTimeoutMs, limits, { PRK_TARGET_CACHE_ROOT: config.targetCacheRoot });
        return { command: "", transport: {
          write(bytes) {
            if (active) {
              active.wireBytes += Buffer.byteLength(bytes);
              if (bytes.startsWith("{")) {
                const message = JSON.parse(bytes);
                if (message.mod === "remoteExtensions") {
                  if (message.op === "platform") active.deployStart ??= ns();
                  if (message.op === "start") active.hostStart = ns();
                  if (message.op === "assetChunk") {
                    const length = message.data.length / 4 * 3 - (message.data.endsWith("==") ? 2 : message.data.endsWith("=") ? 1 : 0);
                    active.assetBytes += length;
                    active.assetByHash[message.sha256] = (active.assetByHash[message.sha256] ?? 0) + length;
                  }
                  if (message.op === "assetBegin") active.assetMetadata.push({ name: message.name, sha256: message.sha256, size: message.size, kind: message.kind });
                }
              }
            }
            raw.write(bytes);
          },
          onData: (listener) => raw.onData(listener), onClose: (listener) => raw.onClose(listener), close: () => raw.close(),
        } };
      } });
      const { runtime, faux } = await createProbeProvider({ ModelRuntime, fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentSystemPrompt, getCurrentTools, agentDir, text, ns, remoteReload, mode, getActive: () => active });
      const generations = [];
      const host = await createGatewayHost({ cwd, home, noSkills: true, historyDir: join(home, "history"), model: "spawn-bench/parent", thinkingLevel: "off", config, targets: [target] }, {
        runtimeDependencies: { model: faux.getModel("parent"), modelRuntime: runtime, thinkingLevel: "off", cwd, agentDir, targetChannels: channels, targetEnvironments: environments },
        onRemoteExtensionGeneration(generation, context) {
          if (!context.sessionId) return;
          generations.push({ pid: generation.registration.pid, sessionId: context.sessionId });
          if (active) { active.hostReadyNs = ns(); active.hostPid = generation.registration.pid; }
        },
      });
      fixture.onCleanup(() => host.close());
      const endpoint = await startGateway(host, join(root, "gateway.sock"));
      fixture.onCleanup(() => endpoint.close());
      const client = await connectGateway(join(root, "gateway.sock"));
      fixture.onCleanup(() => client.disconnect());
      const parent = (await client.request("createSession", { target: targetName })).session.sessionId;
      const action = async (worker, actionName, actionArgs) => {
        const answer = await client.request("nativeAction", { sessionId: worker, requestId: randomUUID(), action: actionName, ...(actionArgs ? { args: actionArgs } : {}) });
        assert.equal(answer.status, "completed", JSON.stringify(answer));
      };
      await action(parent, "tool-mode", { mode: "direct" });
      const idle = (worker) => until(() => host.session(worker).isIdle, `idle ${worker}`);
      const call = async (tool, toolArgs) => {
        await idle(parent);
        const admission = await host.session(parent).submit({ requestId: randomUUID(), message: `BENCH_PARENT ${JSON.stringify({ tool, args: toolArgs })}` });
        assert(admission.accepted, JSON.stringify(admission));
        assert.equal((await admission.completion).status, "completed");
      };
      const subscription = host.session(parent).subscribe((event) => {
        if (active && event.type === "session_event" && event.details?.toolName === "session_spawn") {
          if (event.details.sdkType === "tool_execution_start") active.spawnToolStartNs = ns();
          if (event.details.sdkType === "tool_execution_end") {
            active.spawnToolEndNs = ns();
            active.admissionRss = process.memoryUsage.rss();
          }
        }
        if (active && event.type === "session_event" && event.details?.sdkType === "message_start"
          && event.details.message?.role === "custom" && text(event.details.message).includes(active.marker)) active.parentReceivedNs ??= ns();
      });
      fixture.onCleanup(async () => subscription.unsubscribe());
      const gone = async (pid) => {
        try { const status = await readFile(`/proc/${pid}/stat`, "utf8"); return status.slice(status.lastIndexOf(")") + 2).startsWith("Z"); }
        catch (error) { if (error.code === "ENOENT") return true; throw error; }
      };
      const spawnOne = measureChild.bind(undefined, { setActive(value) { active = value; }, idle, parent, fixture, remoteReload, call, targetName, action, host, mode, native, ns, ms, until, text });
      const destroy = destroyChild.bind(undefined, { idle, parent, ns, call, until, gone, fixture, host, sleep, ms });
      data.baselineRss = process.memoryUsage.rss();
      for (let i = 0; i < samples; i++) {
        const row = await spawnOne(i + 1, { cold: remoteReload });
        await destroy(row);
        await progress("samples", row);
      }
      if (remoteReload) for (let i = 0; i < samples; i++) {
        const row = await spawnOne(i + 1);
        assert.equal(row.metrics.assetBytes, 0, "Hot cache must avoid artifact payload transfer");
        await destroy(row);
        await progress("hot", row);
      }
      const held = [];
      for (let i = 0; i < samples; i++) {
        const row = await spawnOne(i + 1, { idleOnly: true });
        held.push(row);
        await progress("retained", row);
      }
      for (const row of held.reverse()) await destroy(row);
      data.churnBaselineRss = process.memoryUsage.rss();
      for (let i = 0; i < cycles; i++) {
        const row = await spawnOne(i + 1);
        await destroy(row);
        row.metrics.gatewayChurnDeltaBytes = row.afterRss - data.churnBaselineRss;
        await progress("churn", row);
      }
      data.finalRss = process.memoryUsage.rss();
      data.cooldownRss = [];
      for (const delay of [1000, 4000]) {
        await sleep(delay);
        data.cooldownRss.push({ elapsedMs: data.cooldownRss.length ? 5000 : 1000, rssBytes: process.memoryUsage.rss() });
      }
      data.generations = generations;
      await host.close();
      await until(async () => (await Promise.all(generations.map(({ pid }) => gone(pid)))).every(Boolean), "all recorded host processes exit");
      const kernelPids = [...data.samples, ...data.hot, ...data.retained, ...data.churn].flatMap((row) => row.kernel ? [row.kernel.pid] : []);
      assert((await Promise.all(kernelPids.map(gone))).every(Boolean), "Every measured owned REPL exits");
      data.finalCleanup = { allHostsExited: true, allReplsExited: true, kernelPids };
      await jsonFile(destination, data);
    }, { tempParent: root, allowHidden: true, rootDir: () => "/" });
  } finally { await rm(root, { recursive: true, force: true }); }
}

import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
// Real Gateway/Pi/faux + owned Jupyter + target channel + native extension host. No paid models.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, chmod, copyFile, mkdir, mkdtemp, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { findFixtureExecutable, prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { runAcceptance } from "./native-remote/run-acceptance.mjs";

assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Only owned Jupyter fixtures are allowed");
assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");
assert.equal(process.env.SHELL, "/bin/bash", "Run this acceptance test with SHELL=/bin/bash");
const runProcess = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "prk-native-remote-"));
const home = join(root, "gateway");
const previousHome = process.env.HOME;
process.env.HOME = join(root, "gateway-home");
const { agentDir, configPath } = initializePrkHome(home);
const nativeNames = ["bash", "edit", "find", "grep", "ls", "read", "write"];
const fileHelpers = ["read", "edit", "write", "grep"];
const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const exists = (path) => access(path).then(() => true, () => false);
const q = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const proofs = [];
const proof = (name, details) => { proofs.push({ name, ...details }); console.log(JSON.stringify(proofs.at(-1))); };

try {
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" }));
  const bwrap = await findFixtureExecutable("bwrap");
  const python = await findFixtureExecutable("python3", process.env.PI_TEST_PYTHON);
  const artifacts = await prepareNativeToolArtifacts(home);
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools, getCurrentSystemMessage, getSystemMessageText } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { createTargetChannels } = await import("../../src/target-channel/channels/assemble-channels.ts");
  const { openProcessTransport } = await import("../../src/target-channel/process-transport/open.ts");

  const source = join(root, "plugin");
  await mkdir(source);
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "@prk-tests/native-remote", version: "1.0.0", private: true,
    type: "module", files: ["index.js"], pi: { extensions: ["./index.js"] } }));
  await copyFile(new URL("../fixtures/native-remote-plugin.mjs", import.meta.url), join(source, "index.js"));
  const pkg = { source };

  const targetRoot = join(root, "target-storage");
  const target = `/mnt/prk-native-remote-${process.pid}`;
  const targetCwd = `${target}/workspace`;
  const backingCwd = join(targetRoot, "workspace");
  const localCwd = join(root, "local-workspace");
  const gatewayCwd = join(root, "gateway-workspace");
  const targetPath = join(root, "target-path");
  for (const directory of [backingCwd, localCwd, gatewayCwd, targetPath]) await mkdir(directory, { recursive: true });
  assert.equal(await exists(target), false, "Target paths must not exist in the Gateway mount namespace");
  await symlink(python, join(targetPath, "python3"));
  // Enough for the owned Jupyter kernelspec/cgroup launcher and the channel's shell; no rg/fd/fdfind.
  for (const name of ["bash", "sh", "env", "which", "systemctl", "systemd-run", "stty", "ps", "kill", "sleep"]) {
    await symlink(await findFixtureExecutable(name), join(targetPath, name));
  }
  const files = { "content.txt": "NATIVE_REAL_CONTENT\nSECOND_LINE\n", "needle-only.txt": "NATIVE_SEARCH_NEEDLE\n",
    "fuzzy.txt": "const greeting = “remote”;\t  \nstable\n", "blocked.txt": "NATIVE_BLOCKED_ORIGINAL\n", "mutate.txt": "NATIVE_MUTATE_ORIGINAL\n" };
  for (const [name, content] of Object.entries(files)) await writeFile(join(backingCwd, name), content);
  for (const name of ["content.txt", "fuzzy.txt", "written.txt", "bash.txt"]) await writeFile(join(gatewayCwd, name), "GATEWAY_SENTINEL\n");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await writeFile(join(backingCwd, "pixel.png"), png);
  await writeFile(join(backingCwd, "large.txt"), "LARGE_NATIVE_OLD\n" + `${"x".repeat(127)}\n`.repeat(40960));
  const fileBytes = (await stat(join(backingCwd, "large.txt"))).size;
  assert(fileBytes >= 5 * 1024 * 1024);
  await writeFile(join(localCwd, "local.txt"), "LOCAL_FILE_ORIGINAL\n");
  const wrapper = join(root, "target-shell");
  await writeFile(wrapper, `#!/bin/bash\nexec ${q(bwrap)} --unshare-net --ro-bind / / --bind ${q(process.env.XDG_RUNTIME_DIR ?? "/tmp")} ${q(process.env.XDG_RUNTIME_DIR ?? "/tmp")} --bind ${q(root)} ${q(root)} --tmpfs /mnt --bind ${q(targetRoot)} ${q(target)} --dev /dev --proc /proc --setenv PATH ${q(targetPath)} --setenv PRK_NATIVE_TEST_BASE_PATH ${q(targetPath)} --setenv PI_OFFLINE 0 --setenv SHELL /bin/bash /bin/sh\n`);
  await chmod(wrapper, 0o700);
  const gatewayNetworkNamespace = await readlink("/proc/self/ns/net");

  await withTargetFixture(async (remoteFixture) => {
    await withTargetFixture(async (localFixture) => {
      const document = { monitor: { enabled: false }, targetConnection: { startTimeoutMs: 15000 }, memory: { review: false },
        remoteHost: { runtime: process.env.PI_TEST_REMOTE_HOST_RUNTIME ?? "bun" },
        session: { noExtensions: false, bootstrapNoSkills: true, localTools: false, workerTools: "code", idleTimeoutMs: 600000 },
        targetCacheRoot: join(root, "target-cache") };
      await writeFile(configPath, stringify(document));
      const configuration = parsePrkConfig(document);
      const targets = [
        executionTargetFromConfig({ ...remoteFixture.config, id: "remote", label: "Owned native remote", local: false, sshCommand: remoteFixture.config.sshCommand, tags: [], cwd: targetCwd }),
        executionTargetFromConfig({ ...remoteFixture.config, id: "bare", label: "Owned native without plugins", local: false, sshCommand: remoteFixture.config.sshCommand, tags: [], cwd: targetCwd }),
        executionTargetFromConfig({ ...localFixture.config, id: "local", label: "Owned local", local: true, tags: [], cwd: localCwd }),
      ];
      const byteCounts = Object.fromEntries(targets.map(({ id }) => [id, { sent: 0, received: 0, opens: 0 }]));
      const channels = createTargetChannels({ options: { ...configuration.targetConnection, processWindow: configuration.processWindow }, async open(machine, signal, limits) {
        const selected = targets.find((entry) => entry.id === machine);
        assert(selected, machine);
        const fixture = selected.local ? localFixture : remoteFixture;
        const raw = await openProcessTransport(await fixture.runtime.acquire(), selected.python, selected.kernel.cwd, signal, configuration.targetConnection.startTimeoutMs, limits, { PRK_TARGET_CACHE_ROOT: configuration.targetCacheRoot });
        const count = byteCounts[machine];
        count.opens++;
        // The remote daemon, stdio channel and native hosts share the network-isolated target shell.
        return { command: "", transport: {
          write(data) { count.sent += Buffer.byteLength(data, "utf8"); raw.write(data); },
          onData(listener) { raw.onData((data) => { count.received += Buffer.byteLength(data, "utf8"); listener(data); }); },
          onClose(listener) { raw.onClose(listener); },
          close() { return raw.close(); },
        } };
      } });
      const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
      const provider = fauxProvider({ provider: "native-remote-controlled", models: [{ id: "controlled", input: ["text", "image"] }], tokensPerSecond: 100000 });
      modelRuntime.registerNativeProvider(provider.provider);
      const generations = [];
      const host = await createGatewayHost({ cwd: gatewayCwd, home, noSkills: true, historyDir: join(home, "history"),
        model: "native-remote-controlled/controlled", thinkingLevel: "off", config: configuration, targets }, {
        runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: gatewayCwd, agentDir, targetChannels: channels },
        onRemoteExtensionGeneration(generation, context) { generations.push({ ...context, host: generation }); },
      });
      localFixture.onCleanup(() => host.close());
      const endpoint = await startGateway(host, join(root, "gateway.sock"));
      localFixture.onCleanup(() => endpoint.close());
      const client = await connectGateway(join(root, "gateway.sock"));
      localFixture.onCleanup(() => client.disconnect());
      await runAcceptance({ host, client, provider, generations, pkg, root, home, backingCwd, localCwd,
        gatewayCwd, targetCwd, targetPath, files, byteCounts, fileBytes, artifacts, gatewayNetworkNamespace,
        nativeNames, fileHelpers, text, exists, q, proofs, proof, fauxAssistantMessage, fauxToolCall,
        getCurrentTools, getCurrentSystemMessage, getSystemMessageText });
    }, { tempParent: root, allowHidden: true, rootDir: () => "/" });
  }, { sshCommand: q(wrapper), tempParent: root });
} finally {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}

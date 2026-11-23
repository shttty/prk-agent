import assert from "node:assert/strict";
import { createOwnedEnvironment } from "../../fixtures/target-environment/create-owned-environment.mjs";
import { createOwnedRuntime } from "../runtime-channel/create-owned-runtime.mjs";
import { awaitTargetFile } from "../runtime-channel/await-target-file.mjs";
import { createTargetChannels } from "../../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";
import { assembleGeneration } from "../../../src/remote-extensions/generation/assemble-generation.ts";
import { DEFAULT_REMOTE_HOST_OPTIONS } from "../../../src/config/remote-host/remote-host-options.ts";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";
import { DEFAULT_CODEMODE_OPTIONS } from "../../../src/config/codemode/codemode-options.ts";

export async function createHostFixture(mode, store, artifacts, runtimeOptions = {}) {
  assert(["local", "office"].includes(mode));
  if (mode === "office") assert(process.env.PI_TEST_SSH);
  const fixture = await createOwnedEnvironment({ prefix: "prk-S5-", remoteCommand: mode === "office" ? process.env.PI_TEST_SSH : undefined });
  const id = mode === "office" ? "shell" : "local";
  const python = mode === "office" ? (process.env.PI_TEST_REMOTE_PYTHON ?? "/usr/bin/python3") : process.env.PI_TEST_PYTHON;
  const owned = await createOwnedRuntime(fixture, python, 0, runtimeOptions);
  let environment;
  let opens = 0;
  const channels = createTargetChannels({
    options: { startTimeoutMs: 15000 },
    open: async (_, signal, limits) => {
      opens++;
      environment = await fixture.acquire(id);
      return { transport: await openProcessTransport(environment, owned.executable, fixture.root, signal, 15000, limits), command: "" };
    },
  });
  const generations = [];
  return {
    fixture, channels, id, get opens() { return opens; },
    write: async (name, source) => {
      const path = `${fixture.root}/${name}`;
      await fixture.observe(`printf %s ${quoteShell(source)} > ${quoteShell(path)}\n`);
      return path;
    },
    open: (projectExtensions = [], runtime = DEFAULT_REMOTE_HOST_OPTIONS.runtime) => {
      const host = assembleGeneration({ channels, machine: id, storeDir: store.directory, artifacts, nativeTools: true,
        cwd: fixture.root, packages: [], projectExtensions, projectTrusted: true,
        hostOptions: { ...DEFAULT_REMOTE_HOST_OPTIONS, runtime }, binChunkBytes: DEFAULT_CODEMODE_OPTIONS.binChunkBytes });
      generations.push(host);
      return host;
    },
    identity: async () => ({ ...JSON.parse(await awaitTargetFile(fixture, `${owned.prefix}.json`)), daemon: environment.info.pid }),
    close: async () => {
      try { for (const host of generations) await host.close(); }
      finally { await fixture.close(); }
    },
  };
}

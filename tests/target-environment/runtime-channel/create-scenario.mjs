import assert from "node:assert/strict";
import { createOwnedEnvironment } from "../../fixtures/target-environment/create-owned-environment.mjs";
import { createTargetChannels } from "../../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";
import { createOwnedRuntime } from "./create-owned-runtime.mjs";
import { awaitTargetFile } from "./await-target-file.mjs";

export async function createScenario(mode, { timeoutMs = 10000, gate = false } = {}) {
  assert.ok(["local", "office"].includes(mode), `Unknown mode: ${mode}`);
  if (mode === "office") assert.ok(process.env.PI_TEST_SSH, "PI_TEST_SSH required");
  const python = mode === "office" ? "/usr/bin/python3" : process.env.PI_TEST_PYTHON;
  assert.ok(python, "PI_TEST_PYTHON required");
  const fixture = await createOwnedEnvironment({ remoteCommand: mode === "office" ? process.env.PI_TEST_SSH : undefined });
  const id = mode === "office" ? "shell" : "local";
  const openings = [];
  const leases = [];
  const logs = [];
  const channels = createTargetChannels({
    options: { startTimeoutMs: timeoutMs },
    log: (message) => logs.push(message),
    open: async (_machine, signal) => {
      const lease = await fixture.acquire(id);
      const owned = await createOwnedRuntime(fixture, python, openings.length, { gate });
      const entry = { lease, ...owned };
      openings.push(entry);
      return { transport: await openProcessTransport(lease, owned.executable, fixture.root, signal, timeoutMs), command: "" };
    },
  });
  return {
    fixture, id, python, openings, logs,
    acquire: () => {
      const lease = channels.acquire(id);
      leases.push(lease);
      return lease;
    },
    identity: async (index = openings.length - 1) => {
      const entry = openings[index];
      assert.ok(entry, "Runtime was never opened");
      const identity = JSON.parse(await awaitTargetFile(fixture, `${entry.prefix}.json`));
      assert.equal(identity.signature, entry.signature);
      assert.equal(identity.pid, identity.pgid, "SDK process must own its process group");
      assert.ok(identity.child > 0 && identity.runtimePid > 0);
      return { ...identity, generation: entry.lease.generation, daemon: entry.lease.info.pid };
    },
    close: async () => {
      try { await Promise.all(leases.map((lease) => lease.release())); }
      finally { await fixture.close(); }
    },
  };
}

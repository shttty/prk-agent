import assert from "node:assert/strict";
import { createTargetEnvironments } from "../../../src/target-environment/connection/assemble-environments.ts";
import { createTargetChannels } from "../../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";

export function createObservedChannels(resolve, options) {
  const environments = createTargetEnvironments({ resolve: (id) => {
    const target = resolve(id);
    return target.local ? { local: true } : { local: false, command: target.sshCommand };
  } });
  const active = new Map();
  const channels = createTargetChannels({ options, open: async (id, signal, limits) => {
    const target = resolve(id);
    const lease = await environments.acquire(id);
    const transport = await openProcessTransport(lease, target.python, target.cwd, signal, options.startTimeoutMs, limits);
    const record = { name: lease.generation, target: id, daemonPid: lease.info.pid, lease };
    active.set(id, record);
    transport.onClose(() => { if (active.get(id) === record) active.delete(id); });
    return { transport, command: "" };
  } });
  return {
    environments, channels,
    active: () => [...active.values()].map(({ name, target, daemonPid }) => ({ name, target, daemonPid })),
    disconnect: async (generation) => {
      const record = [...active.values()].find((entry) => entry.name === generation);
      assert(record, "Only a registered owned channel may be disconnected");
      await record.lease.retire(new Error("Owned acceptance disconnect"));
    },
  };
}

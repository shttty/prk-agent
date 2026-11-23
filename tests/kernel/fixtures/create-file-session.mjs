import { createSession } from "./create-session.mjs";
import { createTargetFileTools } from "../../../src/sessions/target-files/create-tools.ts";
import { KERNEL_READ_NOTICE } from "../../../src/sessions/target-files/file-protocol.ts";
import { createTargetChannels } from "../../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";
import { DEFAULT_MONITOR_OPTIONS } from "../../../src/config/monitor/monitor-options.ts";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";

export async function createFileSession(target, hooks) {
  const limits = parseProcessWindowLimits();
  const channels = createTargetChannels({ options: DEFAULT_MONITOR_OPTIONS, processWindow: limits,
    open: async (_machine, signal) => ({ transport: await openProcessTransport(await target.acquire(), target.python, target.root, signal, DEFAULT_MONITOR_OPTIONS.startTimeoutMs, limits), command: "" }) });
  let lease, fixture;
  const close = async () => { await fixture?.close(); await lease?.release(); };
  try {
    const tools = createTargetFileTools(() => lease ??= channels.acquire("fixture"), target.root);
    fixture = await createSession(target, { tools, hooks: { ...hooks, fileReadNotice: KERNEL_READ_NOTICE } });
    return { owner: fixture.owner, run: fixture.run, close };
  } catch (error) { await close(); throw error; }
}

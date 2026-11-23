import type { TargetChannelDeps, TargetChannels } from "./channel-types.ts";
import type { ChannelsContext } from "./channel-state.ts";
import { acquire } from "./acquire.ts";
import { start } from "./lifecycle/start-machine.ts";
import { fail } from "./lifecycle/fail-machine.ts";
import { stop } from "./lifecycle/stop-machine.ts";
import { notify } from "./state/notify-state.ts";
import { parseProcessWindowLimits } from "../../target-environment/process-window/parse-limits.ts";

/** Project-owned transport lifecycle, shared by each machine's consumer leases. */
export function createTargetChannels(deps: TargetChannelDeps): TargetChannels {
  const options = { ...deps.options, processWindow: parseProcessWindowLimits(deps.options.processWindow) };
  const log = deps.log ?? (() => undefined);
  const ctx: ChannelsContext = {
    deps, options, log, machines: new Map(),
    start: (machine) => start(ctx, machine),
    fail: (machine, cause) => fail(ctx, machine, cause),
    stop: (machine) => stop(ctx, machine),
    notify: (listener, state) => notify(ctx, listener, state),
  };
  return { acquire: (id) => acquire(ctx, id) };
}

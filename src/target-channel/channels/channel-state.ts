import type { TargetChannelDeps, TargetChannelOptions, MachineRecord, LinkWaiter, TargetState } from "./channel-types.ts";
import type { RuntimeLink } from "../runtime-link/link-types.ts";

export interface ChannelsContext {
  readonly deps: TargetChannelDeps;
  readonly options: Required<TargetChannelOptions>;
  readonly log: (message: string) => void;
  readonly machines: Map<string, MachineRecord>;
  start(machine: MachineRecord): Promise<void>;
  fail(machine: MachineRecord, cause: unknown): void;
  stop(machine: MachineRecord): Promise<void>;
  notify(listener: (state: TargetState) => void, state: TargetState): void;
}

export interface LinkWaiterContext {
  readonly machine: MachineRecord;
  readonly signal: AbortSignal;
  readonly result: PromiseWithResolvers<RuntimeLink>;
  readonly waiter: LinkWaiter;
  readonly abort: () => void;
}

import type { TargetTransport } from "../process-transport/transport-types.ts";
import type { LeaseRecord, TargetLease } from "../lease/lease-types.ts";
import type { RuntimeLink } from "../runtime-link/link-types.ts";
import type { ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";

export interface TargetChannelOptions {
  readonly startTimeoutMs: number;
  readonly processWindow?: ProcessWindowLimits;
}
export type TargetEvent = Record<string, unknown> & { readonly mod: string; readonly t: string };
export interface TargetState {
  readonly state: "starting" | "ok" | "error" | "stopped";
  readonly error?: string;
}
export interface TargetChannels {
  acquire(machine: string): TargetLease;
}
export interface TargetChannelDeps {
  readonly options: TargetChannelOptions;
  open(machine: string, signal: AbortSignal, processWindow: ProcessWindowLimits): Promise<{ readonly transport: TargetTransport; readonly command: string }>;
  readonly log?: (message: string) => void;
}
export interface LinkWaiter { resolve(link: RuntimeLink): void; reject(error: Error): void }
export interface MachineRecord {
  readonly id: string;
  readonly leases: Set<LeaseRecord>;
  readonly waiters: Set<LinkWaiter>;
  state: TargetState["state"];
  error: string | undefined;
  failure: Error | undefined;
  link: RuntimeLink | undefined;
  abort: AbortController | undefined;
  generation: number;
}

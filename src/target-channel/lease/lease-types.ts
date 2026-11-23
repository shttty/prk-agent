import type { TargetEvent, TargetState } from "../channels/channel-types.ts";
import type { ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";

export interface TargetLease {
  readonly processWindow: ProcessWindowLimits;
  request(mod: string, op: string, args?: Record<string, unknown>): Promise<Record<string, unknown>>;
  subscribe(listener: (event: TargetEvent) => void): () => void;
  /** Immediately reports the current generation's state, then every transition. */
  onState(listener: (state: TargetState) => void): () => void;
  state(): TargetState;
  release(): Promise<void>;
}

export interface LeaseRecord {
  readonly abort: AbortController;
  readonly events: Set<(event: TargetEvent) => void>;
  readonly states: Set<(state: TargetState) => void>;
}

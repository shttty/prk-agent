import type { SessionHost, SessionHostEvent } from "../../sessions/host/host-types.ts";
import type { HostContext } from "../host/host-state.ts";

export type HostBinding = {
  refresh(publishSnapshot?: boolean): void;
  fence(): void;
  dispose(): void;
  idleSince?: number;
};

export interface SessionHostsState {
  hosts: Map<string, SessionHost>;
  hostBindings: Map<string, HostBinding>;
}

export interface HostBindingContext {
  readonly sessionId: string;
  readonly parent: HostContext;
  readonly subscribers: Set<(event: SessionHostEvent) => void>;
  source: SessionHost | undefined;
  unsubscribe: (() => void) | undefined;
  original: SessionHost | undefined;
  fenced: SessionHost | undefined;
  kernelCellProjection?: { streamId: string; activeIds: readonly string[] };
  readonly binding: HostBinding;
}

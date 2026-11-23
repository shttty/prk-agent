import { StringDecoder } from "node:string_decoder";
import type { RemoteProcess } from "@earendil-works/pi-env";
import type { TargetEnvironmentLease } from "../../target-environment/connection/connection-types.ts";
import type { ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";

export interface ProcessTransportState {
  readonly lease: TargetEnvironmentLease;
  readonly limits: ProcessWindowLimits;
  readonly decoder: StringDecoder;
  readonly dataListeners: Set<(data: string) => void>;
  readonly closeListeners: Set<(reason: string) => void>;
  readonly startup: PromiseWithResolvers<never>;
  process: RemoteProcess | undefined;
  pending: string[];
  pendingBytes: number;
  stderr: Buffer;
  closed: string | undefined;
  closing: Promise<void> | undefined;
  retire: () => void;
}

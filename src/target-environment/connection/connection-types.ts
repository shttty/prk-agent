import type { Connection, RemoteInfo } from "@earendil-works/pi-env";

export type TargetConnectionInput = { readonly local: true } | {
  readonly local: false;
  readonly command: string;
};
export interface TargetEnvironmentLease {
  readonly connection: Connection;
  readonly info: RemoteInfo;
  readonly generation: string;
  readonly signal: AbortSignal;
  retire(reason: Error): Promise<void>;
  release(): Promise<void>;
}
export interface TargetEnvironments {
  acquire(id: string): Promise<TargetEnvironmentLease>;
}
export interface TargetEnvironmentOptions {
  resolve(id: string): TargetConnectionInput;
  targetCacheRoot?: string;
  onEvent?: (id: string, event: Record<string, unknown>) => void;
  onLog?: (id: string, text: string) => void;
}

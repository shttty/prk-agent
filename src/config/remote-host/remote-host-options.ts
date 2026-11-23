export interface RemoteHostOptions {
  readonly runtime: "bun" | "node";
  readonly memoryMax: number;
  readonly memorySwapMax: number;
  readonly abortTimeoutMs: number;
  readonly nodeArgs: readonly string[];
  readonly bunArgs: readonly string[];
}

export const DEFAULT_REMOTE_HOST_OPTIONS: RemoteHostOptions = Object.freeze({
  runtime: "bun",
  memoryMax: 1024 * 1024 * 1024,
  memorySwapMax: 0,
  abortTimeoutMs: 5000,
  nodeArgs: Object.freeze(["--optimize-for-size"]),
  bunArgs: Object.freeze(["--smol"]),
});

import type { KernelSnapshot } from "../kernel-types.ts";

export interface KernelFailure {
  readonly kernelId: string;
  readonly state: Extract<KernelSnapshot["state"], "failed" | "unavailable">;
  readonly reason: unknown;
}

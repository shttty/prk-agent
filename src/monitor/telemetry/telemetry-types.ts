import type { KernelMemory } from "../../codemode/kernel-protocol/kernel-protocol-types.ts";

export interface RemoteHostMonitor {
  readonly state: "running" | "replacing" | "failed";
  readonly generation: string;
  readonly pid?: number;
  readonly scoped?: boolean;
  readonly memory?: KernelMemory;
  readonly error?: string;
  readonly sampledAt?: number;
  readonly ageMs?: number;
}

export interface MachineSample {
  readonly cpu: { readonly pct: number | null; readonly cores: number };
  readonly load: readonly number[] | null;
  readonly mem: { readonly total: number; readonly available: number } | null;
  readonly disk: { readonly total: number; readonly free: number } | null;
  readonly gpus: readonly { readonly name: string; readonly memUsed: number; readonly memTotal: number; readonly util: number }[];
}
export interface ChangedFile {
  readonly path: string;
  readonly status: string;
  readonly added: number;
  readonly removed: number;
  readonly binary: boolean;
}
export interface DirSample {
  readonly dir: string;
  readonly git: boolean;
  readonly added: number;
  readonly removed: number;
  readonly files: readonly ChangedFile[];
  readonly truncated: boolean;
  readonly disk: { readonly total: number; readonly free: number } | null;
  readonly error: string | null;
  /** git:false only: the first stderr line of `git rev-parse --show-toplevel`. */
  readonly reason: string | null;
  /** git:false only: git could not decide (dubious ownership, broken .git, no git binary), not a plain "not a repository". */
  readonly unavailable: boolean;
}
interface DiskSample {
  readonly dir: string;
  readonly disk: { readonly total: number; readonly free: number } | null;
}
export type CollectorMessage =
  | ({ t: "machine" } & MachineSample)
  | ({ t: "dir" } & DirSample)
  | ({ t: "disk" } & DiskSample);

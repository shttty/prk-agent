export const DEFAULT_KERNEL_RUNTIME_OPTIONS = Object.freeze({
  telemetryIntervalMs: 1000,
  cleanupPollMs: 10,
  maxOutputChars: 32768,
  startTimeoutMs: 10000,
  closeTimeoutMs: 3000,
  progressIntervalMs: 100,
  maxProgressUpdates: 128,
  progressSuffixChars: 128,
  maxImages: 8,
  maxImageBytes: 20 * 1024 * 1024,
  chunkBytes: 64 * 1024,
});
export type KernelRuntimeOptions = { readonly [K in keyof typeof DEFAULT_KERNEL_RUNTIME_OPTIONS]: number } & {
  readonly executionTimeoutMs?: number;
};

export const DEFAULT_SYNC_EXECUTION_TIMEOUT_MS = 300_000;
export const CELL_MODES = ["thread", "async", "isolated"] as const;
export type CellMode = typeof CELL_MODES[number];

export function isCellMode(value: unknown): value is CellMode {
  return CELL_MODES.some((mode) => mode === value);
}

export interface KernelExecutionPolicy {
  readonly asyncExecution: boolean;
  readonly reminderLadderMs: readonly number[];
  readonly defaultCellMode: CellMode;
  readonly maxActiveCells: number;
  readonly interruptTimeoutMs: number;
  readonly interruptRestart: "auto" | "never";
  readonly maxTimerWaitMs: number;
  readonly forkserverPreload: readonly string[];
}

export const DEFAULT_KERNEL_EXECUTION_POLICY: KernelExecutionPolicy = Object.freeze({
  asyncExecution: true,
  reminderLadderMs: Object.freeze([60_000, 300_000, 900_000, 1_800_000]),
  defaultCellMode: "thread",
  maxActiveCells: 4,
  interruptTimeoutMs: 10_000,
  interruptRestart: "auto",
  maxTimerWaitMs: 300_000,
  forkserverPreload: Object.freeze([]),
});

export function isExecutionTimeoutMs(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
}

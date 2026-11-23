import { DEFAULT_KERNEL_EXECUTION_POLICY, isCellMode, isExecutionTimeoutMs } from "../../kernel/kernel-options.ts";
import type { GlobalKernelOptions } from "./kernel-options.ts";
import { parseKernelOptions } from "./parse-kernel-options.ts";

export function parseGlobalKernelOptions(value: unknown): GlobalKernelOptions {
  const defaults = DEFAULT_KERNEL_EXECUTION_POLICY;
  if (value === undefined || !value || typeof value !== "object" || Array.isArray(value)) {
    return { ...parseKernelOptions(value), ...defaults };
  }
  const {
    asyncExecution = defaults.asyncExecution, reminderLadderMs = defaults.reminderLadderMs,
    defaultCellMode = defaults.defaultCellMode, maxActiveCells = defaults.maxActiveCells,
    interruptTimeoutMs = defaults.interruptTimeoutMs, interruptRestart = defaults.interruptRestart,
    maxTimerWaitMs = defaults.maxTimerWaitMs, forkserverPreload = defaults.forkserverPreload,
    ...runner
  } = value as Record<string, unknown>;
  if (typeof asyncExecution !== "boolean") invalid("asyncExecution", "a boolean");
  if (!Array.isArray(reminderLadderMs) || reminderLadderMs.length === 0 || [...reminderLadderMs].some((step, i) =>
    !Number.isInteger(step) || step < 1 || step > 2_147_483_647 || (i > 0 && step <= reminderLadderMs[i - 1]))) {
    invalid("reminderLadderMs", "a nonempty strictly increasing array of integers from 1 to 2147483647");
  }
  if (!isCellMode(defaultCellMode)) invalid("defaultCellMode", "thread, async or isolated");
  if (typeof maxActiveCells !== "number" || !Number.isSafeInteger(maxActiveCells) || maxActiveCells < 1) invalid("maxActiveCells", "a positive safe integer");
  if (!isExecutionTimeoutMs(interruptTimeoutMs) || interruptTimeoutMs === 0) invalid("interruptTimeoutMs", "an integer from 1 to 2147483647");
  if (interruptRestart !== "auto" && interruptRestart !== "never") invalid("interruptRestart", "auto or never");
  if (!isExecutionTimeoutMs(maxTimerWaitMs)) invalid("maxTimerWaitMs", "an integer from 0 to 2147483647");
  const moduleName = /^[_\p{XID_Start}][_\p{XID_Continue}]*(?:\.[_\p{XID_Start}][_\p{XID_Continue}]*)*$/u;
  if (!Array.isArray(forkserverPreload) || [...forkserverPreload].some((name) => typeof name !== "string" || !moduleName.test(name))) {
    invalid("forkserverPreload", "an array of dotted Python module names");
  }
  return { ...parseKernelOptions(runner), asyncExecution, reminderLadderMs: Object.freeze([...reminderLadderMs]),
    defaultCellMode, maxActiveCells, interruptTimeoutMs, interruptRestart, maxTimerWaitMs, forkserverPreload: Object.freeze([...forkserverPreload]) };
}

function invalid(key: keyof typeof DEFAULT_KERNEL_EXECUTION_POLICY, expected: string): never {
  throw new Error(`Invalid PRK configuration: kernel.${key} must be ${expected}.`);
}

import { AsyncLocalStorage } from "node:async_hooks";
import { defineTool } from "@earendil-works/pi-coding-agent";
import type { KernelConfiguration, PythonToolHooks, PythonToolClient } from "./kernel-types.ts";
import type { KernelContext } from "./kernel-state.ts";
import { DEFAULT_KERNEL_RUNTIME_OPTIONS, isExecutionTimeoutMs, type KernelRuntimeOptions } from "./kernel-options.ts";
import { createKernelToolDefinition } from "../plugins/kernel/create-kernel-tool-definition.ts";
import { isLibraryCallback } from "../codemode/kernel-protocol/is-library-callback.ts";
import { execute } from "./cell/execute.ts";
import { ensure } from "./lifecycle/ensure.ts";
import { close } from "./lifecycle/close.ts";
import { restart } from "./lifecycle/restart.ts";
import { clear } from "./lifecycle/clear.ts";
import { deleteVariable } from "./namespace/delete-variable.ts";
import { variables } from "./namespace/list-variables.ts";
import { afterCompaction } from "./namespace/mark-compaction.ts";
import { getSnapshot } from "./telemetry/read-snapshot.ts";
import { subscribe } from "./telemetry/subscribe.ts";
import { isFileCallback } from "./callback/is-file-callback.ts";
import { refreshCapabilities } from "./lifecycle/refresh-capabilities.ts";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "./kernel-options.ts";
import { readCell } from "./cell/read-cell.ts";
import { previewCell } from "./cell/preview-cell.ts";
import { interruptCell } from "./process/interrupt-cell.ts";
import { requestCellInterrupt } from "./process/request-cell-interrupt.ts";
import { setLanguage } from "./lifecycle/set-language.ts";
import { prepareHandoff } from "./lifecycle/prepare-handoff.ts";

const clock = {
  now: () => performance.now(),
  schedule(callback: () => void, delayMs: number) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

export function createPythonTool(configuration: KernelConfiguration, hooks: PythonToolHooks = {}, overrides: Partial<KernelRuntimeOptions> = {}): PythonToolClient {
  const options = { ...DEFAULT_KERNEL_RUNTIME_OPTIONS, ...overrides };
  for (const [name, value] of Object.entries(options)) {
    const valid = name === "executionTimeoutMs" ? value === undefined || isExecutionTimeoutMs(value)
      : Number.isSafeInteger(value) && value! > 0 && value! <= 2_147_483_647;
    if (!valid) throw new Error(`Invalid kernel runtime option ${name}.`);
  }
  if (!configuration.python.startsWith("/") || configuration.python.includes("\0") || !configuration.cwd.startsWith("/") || configuration.cwd.includes("\0")) throw new Error("Kernel requires target absolute Python and cwd paths.");
  const runnerMaxActiveCells = hooks.runnerMaxActiveCells ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(runnerMaxActiveCells) || runnerMaxActiveCells < 1) throw new Error("Invalid runner execution capacity.");
  const ctx: KernelContext = {
    configuration, hooks, options, fileCallback: new AsyncLocalStorage<string>(),
    clock: hooks.clock ?? clock, reminderListeners: new Set(),
    finishedListeners: new Set(), pendingFinished: new Map(),
    cells: new Map(), runnerMaxActiveCells,
    snapshot: { state: "not_started", language: configuration.bun ? "bun" : "python", activeCells: [] }, listeners: new Set(), closed: false,
    namespaceAfterCompaction: false, helperNames: [],
  };
  const toolForLanguage = () => defineTool({
    ...createKernelToolDefinition(configuration.target, hooks.codeMode === true, execute.bind(null, ctx, false, undefined), ctx.snapshot.language),
    ...(hooks.codeMode ? { prepareLoadout: (loadout) => ({ hiddenDeclarations: loadout.declared.filter((tool) =>
      isLibraryCallback(tool.name) || hooks.allowGatewayTool?.(tool.name) === false || (hooks.hideToolDeclaration?.(tool.name) ?? tool.name !== "kernel_code")).map(({ name }) => name) }) } : {}),
  });
  let tool = toolForLanguage();
  let toolLanguage = ctx.snapshot.language;
  return {
    get tool() {
      if (toolLanguage !== ctx.snapshot.language) { tool = toolForLanguage(); toolLanguage = ctx.snapshot.language; }
      return tool;
    },
    async ensure() { await (ctx.closed ? ensure(ctx) : ctx.replacing ?? ensure(ctx)); }, close: close.bind(null, ctx), restart: restart.bind(null, ctx),
    executeForeground: execute.bind(null, ctx, true, undefined),
    executeOwned: execute.bind(null, ctx, false),
    prepareHandoff: prepareHandoff.bind(null, ctx),
    resumeAfterHandoff() { ctx.handoff = false; },
    setLanguage: setLanguage.bind(undefined, ctx),
    handoffInProgress: () => ctx.handoff === true,
    hasInFlightCell: () => ctx.cells.size > 0 || ctx.pendingFinished.size > 0 || !!(ctx.starting || ctx.maintenance || ctx.replacing || ctx.changingLanguage),
    asyncExecution: () => (hooks.executionPolicy?.() ?? DEFAULT_KERNEL_EXECUTION_POLICY).asyncExecution,
    readCell: readCell.bind(null, ctx),
    previewCell: previewCell.bind(null, ctx),
    interruptCell: interruptCell.bind(null, ctx),
    requestCellInterrupt: requestCellInterrupt.bind(null, ctx),
    subscribeFinished(listener) {
      ctx.finishedListeners.add(listener);
      return () => { ctx.finishedListeners.delete(listener); };
    },
    clear: clear.bind(null, ctx),
    deleteVariable: deleteVariable.bind(null, ctx),
    refreshCapabilities: refreshCapabilities.bind(null, ctx),
    getSnapshot: getSnapshot.bind(null, ctx),
    variables: variables.bind(null, ctx),
    isFileCallback: isFileCallback.bind(null, ctx),
    afterCompaction: afterCompaction.bind(null, ctx),
    subscribe: subscribe.bind(null, ctx),
    subscribeReminders(listener) {
      ctx.reminderListeners.add(listener);
      return () => { ctx.reminderListeners.delete(listener); };
    },
  };
}

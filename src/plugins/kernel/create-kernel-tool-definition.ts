import { defineTool } from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { pythonToolMetadata } from "../../kernel/describe-python-tool.ts";
import { bunParameters, pythonParameters } from "../../kernel/declaration/kernel-tool-schema.ts";
import { isCellMode } from "../../kernel/kernel-options.ts";
import type { KernelLanguage, PythonToolClient } from "../../kernel/kernel-types.ts";

/** Optional-title guidance; dropped from the declaration while tool titles make the title required. */
export const CELL_TITLE_HINT = "Give each cell a short title.";

export function createKernelToolDefinition(target: string, codeMode: boolean, execute?: PythonToolClient["tool"]["execute"], language: KernelLanguage = "python"): PythonToolClient["tool"] {
  const bun = language === "bun";
  const label = bun ? "Bun (JS/TS)" : "Python";
  const metadata = pythonToolMetadata(target, codeMode);
  const description = bun
    ? `Execute JavaScript/TypeScript on the retained ${target} Bun kernel. Use top-level await, return/display for results, and globalThis.name to retain values. Use cell.sleep/connect/fetch/resolve/spawn for cancellable waits, and cell.import for prepared packages. Unmanaged waits or blocking code can force retirement of the whole kernel.`
    : `${metadata.description} Use thread for ordinary synchronous libraries with shared variables; async for cooperative awaits and shared clients/locks (avoid blocking the shared loop); isolated for potentially stuck DNS/native calls and tasks that need no shared objects. Explicit mode wins; otherwise top-level await selects async, then the configured default applies (normally thread). Only isolated accepts inputs and outputs: copy named inputs, return a value, and optionally bind it to the named output on success. Isolated is not a sandbox. Avoid concurrent writes to the same variable. Stopping one cell may also affect peers using the same socket or child process.`;
  return defineTool({
    ...metadata,
    description: `${description} ${CELL_TITLE_HINT} If yielding is enabled, completion or a checkpoint will wake you; do not poll.`,
    label: `${label} (${target})`,
    promptSnippet: `Execute ${label} code in the retained ${target} kernel`,
    ...(bun ? {} : { promptGuidelines: [`Use Python on the ${target} kernel for calculations and stateful exploration; ordinary input() is unsupported.`] }),
    parameters: bun ? bunParameters : pythonParameters,
    prepareArguments(args) {
      if (args && typeof args === "object") {
        const { mode, inputs, outputs } = args as Record<string, unknown>;
        if (bun && ["mode", "inputs", "outputs"].some((key) => Object.hasOwn(args, key))) {
          throw Object.assign(new Error("Bun cells do not accept Python execution modes or isolated inputs/outputs."), { code: "INVALID_REQUEST", submitted: false });
        }
        // Pi drops optional nulls and coerces array and string values before validation.
        if (Object.hasOwn(args, "mode") && !isCellMode(mode)) {
          throw new Error("kernel_code mode must be thread, async or isolated when provided.");
        }
        if (Object.hasOwn(args, "inputs") && (!Array.isArray(inputs) || !inputs.every((name) => typeof name === "string"))) {
          throw Object.assign(new Error("kernel_code inputs must be an array of strings when provided."), { code: "INVALID_REQUEST", submitted: false });
        }
        if (Object.hasOwn(args, "outputs") && typeof outputs !== "string") {
          throw Object.assign(new Error("kernel_code outputs must be a string when provided."), { code: "INVALID_REQUEST", submitted: false });
        }
      }
      return args as Static<typeof pythonParameters>; // Pi validates the remaining schema.
    },
    executionMode: "sequential",
    execute: execute ?? (async () => { throw new Error("Kernel execution is only available in a managed session."); }),
  });
}

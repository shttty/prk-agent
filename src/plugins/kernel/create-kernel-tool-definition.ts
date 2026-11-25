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
    ? `Run JavaScript/TypeScript on the retained ${target} Bun kernel (top-level await, return/display, globalThis for state; cell.sleep/connect/fetch/resolve/spawn for cancellable waits, cell.import for packages; unmanaged blocking can retire the kernel).`
    : `${metadata.description} Modes: thread (default; shared vars), async (top-level await; shared loop), isolated (separate process for stuck native/DNS; copies inputs/outputs, no sandbox). Stopping a cell may affect other cells using the same subprocess or socket.`;
  return defineTool({
    ...metadata,
    description: `${description} ${CELL_TITLE_HINT} Yielded cells wake you automatically. Run long commands directly in a cell and yield, or use a model terminal; Gateway does not track processes detached from a cell (e.g. subprocess.Popen or nohup), and their exit will not wake you.`,
    label: `${label} (${target})`,
    promptSnippet: `Execute ${label} code in the retained ${target} kernel`,
    ...(bun ? {} : { promptGuidelines: [`Use Python on the ${target} kernel for calculations and stateful exploration; ordinary input() is unsupported.`] }),
    parameters: bun ? bunParameters : pythonParameters,
    prepareArguments(args) {
      if (args && typeof args === "object" && !Array.isArray(args)) {
        let fields = args as Record<string, unknown>;
        const emptyInputs = Array.isArray(fields.inputs) && fields.inputs.length === 0;
        const emptyOutputs = fields.outputs === "";
        if (emptyInputs || emptyOutputs) {
          fields = { ...fields };
          if (emptyInputs) delete fields.inputs;
          if (emptyOutputs) delete fields.outputs;
        }
        if (bun && ["mode", "inputs", "outputs"].some((key) => Object.hasOwn(fields, key))) {
          throw Object.assign(new Error("Bun cells do not accept Python execution modes or isolated inputs/outputs."), { code: "INVALID_REQUEST", submitted: false });
        }
        // Pi drops optional nulls and coerces array and string values before validation.
        if (Object.hasOwn(fields, "mode") && !isCellMode(fields.mode)) {
          throw new Error("kernel_code mode must be thread, async or isolated when provided.");
        }
        if (Object.hasOwn(fields, "inputs") && (!Array.isArray(fields.inputs) || !fields.inputs.every((name) => typeof name === "string"))) {
          throw Object.assign(new Error("kernel_code inputs must be an array of strings when provided."), { code: "INVALID_REQUEST", submitted: false });
        }
        if (Object.hasOwn(fields, "outputs") && typeof fields.outputs !== "string") {
          throw Object.assign(new Error("kernel_code outputs must be a string when provided."), { code: "INVALID_REQUEST", submitted: false });
        }
        return fields as Static<typeof pythonParameters>;
      }
      return args as Static<typeof pythonParameters>; // Pi validates the remaining schema.
    },
    executionMode: "sequential",
    execute: execute ?? (async () => { throw new Error("Kernel execution is only available in a managed session."); }),
  });
}

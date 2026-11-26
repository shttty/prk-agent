import type { KernelPromptInput } from "./prompt-types.ts";
import { renderStubs } from "./render-stubs.ts";

export function renderKernel(input: KernelPromptInput): string {
  if (input.language === "bun") return [
    "Use kernel_code with a JavaScript/TypeScript cell body: top-level await, return/display, and shared globalThis.name. Local declarations do not persist. Use cell.sleep/connect/fetch/resolve/spawn for owned cancelable waits, and cell.import for prepared packages. Unmanaged waits or synchronous blocking can require retiring the whole kernel.",
    input.asyncExecution ? "If a cell yields, end the turn; completion and reminders arrive automatically. Do not poll." : "kernel_code waits for completion and ignores yield_s.",
  ].join("\n");
  const helpers = input.helpers.filter(({ name, available, moduleOnly }) => available !== false && !moduleOnly && input.kernelCapabilities(name));
  const offered = (name: string) => helpers.some((helper) => helper.name === name);
  const binLine = input.binaryPrompt();
  const signature = `kernel_code {code,${input.titleRequired ? "title" : "title?"},reset?,yield_s?,mode?,inputs?,outputs?}`;
  return [
    input.kernelScoped === false
      ? `Use ${signature} for this retained target Python namespace. Pass reset: true to restart the REPL and clear variables.`
      : `Use ${signature} for this retained target Python namespace. The kernel runs inside a cgroup; when its memory is near the limit, del large objects or pass reset: true.`,
    input.asyncExecution
      ? `kernel_code may return running after yield_s (default: configured foreground wait; 0: immediately). End the turn and wait for completion or running reminders; do not poll.${input.cellTools ? " kernel_read and kernel_interrupt are model-only tools outside this busy kernel, not gateway callbacks." : ""}`
      : "kernel_code waits for completion; yield_s is ignored. Previously yielded cells keep their completion notifications; only that active cell may still be read or interrupted with its cell_id.",
    ...(helpers.length ? ["Helpers run on the target cwd, never on the Gateway. View, search and edit files with them, not open()/cat/sed; help(name) shows each one's full details."] : []),
    ...(binLine && offered("tool_bin") ? [binLine] : []),
    ...(input.toolLibrary && input.autoTools && offered("tool") ? ["Save a function with @tool(persist=True, reason=...) only when it is reusable, deterministic and synchronous, not a one-off script; reuse a similar name for a new version."] : []),
    ...(helpers.length ? [renderStubs(helpers)] : []),
  ].join("\n");
}

import type { TextContent } from "@earendil-works/pi-ai";
import type { TerminalOptions } from "../../config/terminal/terminal-options.ts";
import { compactTerminalOutput } from "../../workspace/terminal-output/compact-terminal-output.ts";
import type { KernelCell, KernelContext } from "../kernel-state.ts";
import type { PythonRunningDetails } from "../kernel-types.ts";
import { stoppingSnapshot } from "../cell/stopping-snapshot.ts";

export function runningCellResult(ctx: KernelContext, cell: KernelCell, kernelId: string, toolCallId: string, options: TerminalOptions): { content: TextContent[]; details: PythonRunningDetails } {
  const compact = compactCellOutput(cell, options);
  const stopping = stoppingSnapshot(ctx, cell);
  const reset = cell.reset && { reset: cell.reset };
  return {
    content: [{ type: "text", text: JSON.stringify({ status: "running", cell_id: cell.id, ...stopping, ...reset, output: compact.output,
      truncated: compact.truncated, image_count: cell.images.length + cell.omittedImages,
      note: stopping ? 'Continue waiting or use restart:"now" to retire this generation. Do not poll.'
        : "You can end this turn. Completion or a running reminder will wake you; do not poll." }) }],
    details: { toolCallId, kernelId, startedAt: cell.startedAt, language: ctx.snapshot.language, ...(stopping && { stopping }), ...reset },
  };
}

export function compactCellOutput(cell: KernelCell, options: TerminalOptions) {
  const { text, tail, truncated, omittedChars } = cell.output;
  const compact = compactTerminalOutput(text + tail, "", options, undefined, truncated ? { at: text.length, chars: omittedChars } : undefined);
  return { output: compact.output, truncated: truncated || compact.truncated };
}

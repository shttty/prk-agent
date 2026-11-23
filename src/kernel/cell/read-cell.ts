import type { KernelContext } from "../kernel-state.ts";
import type { KernelToolResult } from "../kernel-types.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../config/terminal/terminal-options.ts";
import { milliseconds } from "../../workspace/model-terminals/timing/parse-duration.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { normalizeCellImages } from "../output/normalize-cell-images.ts";
import { runningCellResult } from "../output/format-running-cell.ts";

export async function readCell(ctx: KernelContext, id: string, seconds?: number, index?: number, signal?: AbortSignal): Promise<KernelToolResult | undefined> {
  const options = ctx.hooks.outputOptions ?? DEFAULT_TERMINAL_OPTIONS;
  const ms = milliseconds(seconds, 0, options.maxYieldMs, "yield_s");
  const cell = ctx.cells.get(id) ?? ctx.pendingFinished.get(id);
  if (!cell?.yielded || !cell.result || !cell.kernelId) return undefined;
  signal?.throwIfAborted();
  if (cell.frozen) return index === undefined ? cell.frozen : selectImage(cell.frozen, index);
  if (cell.outcome !== undefined) {
    const result = await cell.result;
    return index === undefined ? result : selectImage(result, index);
  }
  if (ms > 0) {
    const gate = Promise.withResolvers<undefined>();
    const cancel = ctx.clock.schedule(() => gate.resolve(undefined), ms);
    const abort = () => gate.reject(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const result = await Promise.race([cell.result, gate.promise]) ?? (cell.outcome === undefined ? undefined : await cell.result);
      if (result) return index === undefined ? result : selectImage(result, index);
    } finally {
      cancel();
      signal?.removeEventListener("abort", abort);
    }
  }
  const preview = runningCellResult(ctx, cell, cell.kernelId, cell.toolCallId!, options);
  if (index === undefined) return preview;
  const captured = cell.images[index - 1];
  if (!captured) throw new WireError("NOT_FOUND", "No retained image at that index.");
  const { images, notes } = await normalizeCellImages({ images: [captured], omittedImages: 0 });
  if (!images.length) throw new WireError("NOT_FOUND", notes.join(" "));
  return { ...preview, content: [{ type: "text", text: notes.join(" ") || `Kernel image ${index}.` }, ...images] };
}

export function selectImage(result: KernelToolResult, index: number): KernelToolResult {
  const image = result.content.filter((part) => part.type === "image")[index - 1];
  if (!image) throw new WireError("NOT_FOUND", "No retained image at that index.");
  return { content: [image], details: result.details };
}

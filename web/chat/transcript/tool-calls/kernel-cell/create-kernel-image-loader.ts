import type { ChatActions } from "../../../thread/chat-actions-types.ts";
import { isPayload } from "../../../payload/is-payload.ts";
import { resultImageSource } from "../body/result-image-source.ts";
import type { KernelCellRef, KernelImageLoader } from "./kernel-image-types.ts";
import { loadKernelResult } from "./load-kernel-result.ts";

const RETAINED_SOURCE_CHARS = 24 * 1024 ** 2;

export function createKernelImageLoader(api: ChatActions["api"]): KernelImageLoader {
  const images = new Map<string, { chars: number; promise: Promise<string> }>();
  let retained = 0;
  return (cell: KernelCellRef, index: number) => {
    const key = JSON.stringify([cell.sessionId, cell.kernelId, cell.cellId, cell.toolCallId, index]);
    const cached = images.get(key);
    if (cached) return cached.promise;
    const entry = { chars: 0, promise: loadKernelResult(api, cell, index).then((result) => {
      const source = resultImageSource(result.content.find((part) => isPayload(part) && part.type === "image"));
      if (!source) throw new Error("执行结果不含可显示的图片。");
      entry.chars = source.length;
      retained += entry.chars;
      // A live turn can be replaced by its persisted row. Keep verified image bytes across that remount.
      for (const [id, previous] of images) {
        if (retained <= RETAINED_SOURCE_CHARS) break;
        if (previous.chars) { images.delete(id); retained -= previous.chars; }
      }
      return source;
    }).catch((error: unknown) => { images.delete(key); throw error; }) };
    images.set(key, entry);
    return entry.promise;
  };
}

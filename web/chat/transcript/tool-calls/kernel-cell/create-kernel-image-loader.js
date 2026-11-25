import { resultImageSource } from "../body/result-image-source.js";
import { loadKernelResult } from "./load-kernel-result.js";

const RETAINED_SOURCE_CHARS = 24 * 1024 ** 2;

export function createKernelImageLoader(api) {
  const images = new Map();
  let retained = 0;
  return (cell, index) => {
    const key = JSON.stringify([cell.sessionId, cell.kernelId, cell.cellId, cell.toolCallId, index]);
    const cached = images.get(key);
    if (cached) return cached.promise;
    const entry = { chars: 0, promise: loadKernelResult(api, cell, index).then((result) => {
      const source = resultImageSource(result.content.find(({ type }) => type === "image"));
      if (!source) throw new Error("执行结果不含可显示的图片。");
      entry.chars = source.length;
      retained += entry.chars;
      // A live turn can be replaced by its persisted row. Keep verified image bytes across that remount.
      for (const [id, previous] of images) {
        if (retained <= RETAINED_SOURCE_CHARS) break;
        if (previous.chars) { images.delete(id); retained -= previous.chars; }
      }
      return source;
    }).catch((error) => { images.delete(key); throw error; }) };
    images.set(key, entry);
    return entry.promise;
  };
}

import { open } from "node:fs/promises";
import { ResourceLimitError } from "./create-resource-limit-error.mjs";

export async function readBody(path, budget) {
  const maximum = Math.min(budget.fileLimit, budget.totalLimit - budget.used + 3);
  const data = Buffer.alloc(maximum + 1);
  const source = await open(path, "r");
  let size = 0;
  try {
    while (size < data.length) {
      const { bytesRead } = await source.read(data, size, data.length - size, null);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
  } finally {
    await source.close();
  }
  if (size > budget.fileLimit) throw new ResourceLimitError(`${path}: contextFileBytes limit ${budget.fileLimit} exceeded`);
  const content = data.subarray(0, size).toString("utf8").replace(/^\uFEFF/, "");
  const transferred = Buffer.byteLength(content, "utf8");
  if (transferred > budget.fileLimit) throw new ResourceLimitError(`${path}: contextFileBytes limit ${budget.fileLimit} exceeded`);
  if (budget.used + transferred > budget.totalLimit) throw new ResourceLimitError(`${path}: contextTotalBytes limit ${budget.totalLimit} exceeded`);
  budget.used += transferred;
  return content;
}

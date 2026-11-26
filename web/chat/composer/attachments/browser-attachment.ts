import { MAX_ATTACHMENT_BYTES } from "./attachment-constants.ts";
import { catalogMimeTypes } from "./catalog-mime-types.ts";
import { bytesToBase64 } from "./bytes-to-base64.ts";
import type { AttachmentLimits, StoredAttachment } from "../composer-types.ts";
export async function browserAttachment(file: File, limits: AttachmentLimits = {}): Promise<StoredAttachment & { size: number }> {
  const maxItem = Number.isSafeInteger(limits.maxDecodedBytesPerItem)
    ? limits.maxDecodedBytesPerItem ?? MAX_ATTACHMENT_BYTES
    : Number.isSafeInteger(limits.maxItemBytes) ? limits.maxItemBytes ?? MAX_ATTACHMENT_BYTES : MAX_ATTACHMENT_BYTES;
  const mimeTypes = catalogMimeTypes(limits);
  if (mimeTypes.length && !mimeTypes.includes(file.type)) throw new Error(`不支持的文件类型：${file.type || "未知"}。`);
  if (file.size > maxItem) throw new Error(`${file.name} 超过 ${Math.floor(maxItem / 1024)} KiB 限制。`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { name: file.name.slice(0, 512), type: file.type || "application/octet-stream", size: bytes.byteLength, data: bytesToBase64(bytes), source: "browser" };
}

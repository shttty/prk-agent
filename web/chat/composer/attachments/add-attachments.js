import { MAX_ATTACHMENTS } from "./attachment-constants.js";
import { MAX_TOTAL_ATTACHMENT_BYTES } from "./attachment-constants.js";
import { browserAttachment } from "./browser-attachment.js";
/**
 * `current` with `files` added (or, with `replaceAt`, swapped in for that one entry); throws an Error whose message is
 * the reason shown to the user.
 */
export async function addAttachments(current, files, limits = {}, { replaceAt = null } = {}) {
  const incoming = Array.from(files || []);
  const maxItems = Number.isSafeInteger(limits.maxItems) ? limits.maxItems : MAX_ATTACHMENTS;
  const maxTotal = Number.isSafeInteger(limits.maxDecodedBytesTotal) ? limits.maxDecodedBytesTotal : MAX_TOTAL_ATTACHMENT_BYTES;
  if (replaceAt === null && current.length + incoming.length > maxItems) throw new Error(`最多选择 ${maxItems} 个附件。`);
  const parsed = [];
  let total = current.reduce((sum, item, index) => sum + (index === replaceAt ? 0 : (Number(item.size) || 0)), 0);
  for (const file of incoming) {
    const attachment = await browserAttachment(file, limits);
    total += attachment.size;
    if (total > maxTotal) throw new Error(`附件总大小超过 ${Math.floor(maxTotal / 1024)} KiB 限制。`);
    parsed.push(attachment);
  }
  const next = [...current];
  if (replaceAt !== null && Number.isInteger(replaceAt)) next.splice(replaceAt, 1, ...parsed);
  else next.push(...parsed);
  return next;
}

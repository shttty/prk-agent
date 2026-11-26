import { isTargetMismatch } from "./target-mismatch.ts";
import { TARGET_MISMATCH_NOTICE } from "./target-mismatch.ts";
import { toFailure } from "../../shell/page/to-failure.ts";
import type { ApiFailure, FileStoreContext } from "./file-store-types.ts";

type ReadReply = { content: string; format?: string; last_modified?: string; mimetype?: string; writable?: boolean };

const unreadable = (error: ApiFailure) => (error.code === "TOO_LARGE" ? "文件过大，无法打开。" : error.message);

export async function load(ctx: FileStoreContext, path: string) {
  const file = ctx.files.get(path);
  if (!file) return;
  // A response that arrives after the session moved to another target belongs to the old one: drop it, keep the draft.
  // The request names the target it was started for; the document is then bound to that target.
  const epoch = ctx.epoch;
  const target = ctx.environment;
  ctx.patch(path, { loading: true, error: "", conflict: false });
  try {
    const result: ReadReply = await ctx.api.post(`${ctx.base}/read`, { target, path, ...(file.kind === "image" ? { format: "base64" } : {}) });
    if (epoch !== ctx.epoch) return;
    ctx.patch(path, { loading: false, epoch, target, retargeted: false, saveError: "", kind: file.kind === "image" ? "image" : result.format === "base64" ? "binary" : file.kind, content: result.content, original: result.content, lastModified: result.last_modified, mimetype: result.mimetype, writable: result.writable });
  } catch (cause) {
    const error = toFailure(cause);
    if (epoch !== ctx.epoch || !ctx.files.has(path)) return;
    // The Gateway already moved the session; this page has not learned it yet. Keep any document as it is.
    if (isTargetMismatch(error)) { ctx.patch(path, { loading: false, error: TARGET_MISMATCH_NOTICE, ...(file.epoch === undefined ? {} : { retargeted: true }) }); return; }
    const gone = error.code === "NOT_FOUND" && ctx.restored.has(path);
    ctx.restored.delete(path);
    if (gone) { ctx.files.delete(path); ctx.emit(); ctx.onGone?.(path); return; }
    ctx.patch(path, { loading: false, error: unreadable(error) });
  }
}

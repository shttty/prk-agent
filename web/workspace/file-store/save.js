import { STALE_NOTICE } from "./stale-notice.js";
import { isTargetMismatch } from "./target-mismatch.js";
export async function save(ctx, path, force = false) {
    const file = ctx.files.get(path);
    if (!file || file.saving || file.content === file.original) return;
    // Read from another target than the session's current one, or already refused by the Gateway as such (also for
    // "overwrite"): never written, never retried; only a reload binds the draft's file to the current target.
    if (file.retargeted || file.epoch !== ctx.epoch) { ctx.patch(path, { retargeted: true, saveError: STALE_NOTICE }); return; }
    const epoch = ctx.epoch;
    const content = file.content;
    ctx.patch(path, { saving: true });
    try {
      const meta = await ctx.api.post(`${ctx.base}/write`, { target: file.target, path, content, format: "text", ...(force || !file.lastModified ? {} : { expectedLastModified: file.lastModified }) });
      if (epoch !== ctx.epoch) return;
      ctx.patch(path, { saving: false, conflict: false, original: content, lastModified: meta.last_modified });
    } catch (error) {
      if (epoch !== ctx.epoch) return;
      if (isTargetMismatch(error)) { ctx.patch(path, { saving: false, retargeted: true, saveError: STALE_NOTICE }); return; }
      ctx.patch(path, error.code === "CONFLICT" ? { saving: false, conflict: true } : { saving: false, error: "", saveError: error.message });
    }
  }

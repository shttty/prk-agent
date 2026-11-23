import { mutateWorkbench } from "../workbench-snapshot/mutate-workbench.js";
import { postJson } from "../requests/post-json.js";
export async function mutateArchive(ctx, group, purge) {
    if (!ctx.state.archive.some((entry) => entry.group === group) || ctx.state.pending.has("archiveMutating")) return false;
    return mutateWorkbench(ctx, "archiveMutating", () => postJson(ctx, `${ctx.apiRoot}/archive/${encodeURIComponent(group)}/${purge ? "purge" : "unarchive"}`, purge ? { confirm: true } : {}),
      null,
      purge ? "永久删除结果未确认。" : "取消归档结果未确认。");
  }


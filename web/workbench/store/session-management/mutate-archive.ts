import type { StoreContext } from "../store-context-types.ts";
import { mutateWorkbench } from "../workbench-snapshot/mutate-workbench.ts";
import { postJson } from "../requests/post-json.ts";

export async function mutateArchive(ctx: StoreContext, group: string, purge: boolean): Promise<boolean> {
  if (!ctx.state.archive.some((entry) => entry.group === group) || ctx.state.pending.has("archiveMutating")) return false;
  return mutateWorkbench(ctx, "archiveMutating", () => postJson(`${ctx.apiRoot}/archive/${encodeURIComponent(group)}/${purge ? "purge" : "unarchive"}`, purge ? { confirm: true } : {}),
    null,
    purge ? "永久删除结果未确认。" : "取消归档结果未确认。");
}

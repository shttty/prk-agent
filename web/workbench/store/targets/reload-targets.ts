import type { StoreContext } from "../store-context-types.ts";
import { mutateWorkbench } from "../workbench-snapshot/mutate-workbench.ts";
import { postJson } from "../requests/post-json.ts";

export async function reloadTargets(ctx: StoreContext): Promise<boolean> {
  if (ctx.state.pending.has("reloadingTargets") || ctx.state.pending.has("targetMutating")) return false;
  return mutateWorkbench(ctx, "reloadingTargets", () => postJson(`${ctx.apiRoot}/targets/reload`, {}), "实例配置已刷新。",
    "实例配置刷新失败。", "实例配置刷新未确认。");
}

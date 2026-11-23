import { mutateWorkbench } from "../workbench-snapshot/mutate-workbench.js";
import { postJson } from "../requests/post-json.js";
export async function reloadTargets(ctx) {
    if (ctx.state.pending.has("reloadingTargets") || ctx.state.pending.has("targetMutating")) return false;
    return mutateWorkbench(ctx, "reloadingTargets", () => postJson(ctx, `${ctx.apiRoot}/targets/reload`, {}), "实例配置已刷新。",
      "实例配置刷新失败。", "实例配置刷新未确认。");
  }


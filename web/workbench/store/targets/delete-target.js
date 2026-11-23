import { mutateWorkbench } from "../workbench-snapshot/mutate-workbench.js";
import { requestJson } from "../requests/request-json.js";
export async function deleteTarget(ctx, id) {
    if (!id || ctx.state.pending.has("targetMutating")) return false;
    return mutateWorkbench(ctx, "targetMutating", () => requestJson(ctx, `${ctx.apiRoot}/targets/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({ confirm: true }) }), "实例配置已删除。",
      "实例删除失败。", "实例删除未确认。");
  }


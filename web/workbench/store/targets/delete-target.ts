import type { StoreContext } from "../store-context-types.ts";
import { mutateWorkbench } from "../workbench-snapshot/mutate-workbench.ts";
import { requestJson } from "../requests/request-json.ts";

export async function deleteTarget(ctx: StoreContext, id: string): Promise<boolean> {
  if (!id || ctx.state.pending.has("targetMutating")) return false;
  return mutateWorkbench(ctx, "targetMutating", () => requestJson(`${ctx.apiRoot}/targets/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({ confirm: true }) }), "实例配置已删除。",
    "实例删除失败。", "实例删除未确认。");
}

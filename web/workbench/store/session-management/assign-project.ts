import type { StoreContext } from "../store-context-types.ts";
import { mutateWorkbench } from "../workbench-snapshot/mutate-workbench.ts";
import { requestJson } from "../requests/request-json.ts";

/** Put a session into a project (`{id}` or `{name}` for a new one) or out of it (`null`). */
export async function assignProject(ctx: StoreContext, projectOrNull: { id?: string; name?: string } | null, sessionId: string | null = ctx.state.selectedSessionId): Promise<boolean> {
  const name = sessionId || ctx.state.selectedSessionId;
  if (!name || ctx.state.pending.has("projectMutating")) return false;
  return mutateWorkbench(ctx, "projectMutating", () => requestJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/project`, { method: "PATCH", body: JSON.stringify({ project: projectOrNull }) }), null,
    "项目归属保存失败。", "项目归属保存失败。");
}

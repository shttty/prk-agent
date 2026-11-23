import { mutateWorkbench } from "../workbench-snapshot/mutate-workbench.js";
import { requestJson } from "../requests/request-json.js";
export async function assignProject(ctx, projectOrNull, sessionId = ctx.state.selectedSessionId) {
    const name = sessionId || ctx.state.selectedSessionId;
    if (!name || ctx.state.pending.has("projectMutating")) return false;
    return mutateWorkbench(ctx, "projectMutating", () => requestJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/project`, { method: "PATCH", body: JSON.stringify({ project: projectOrNull }) }), null,
      "项目归属保存失败。", "项目归属保存失败。");
  }


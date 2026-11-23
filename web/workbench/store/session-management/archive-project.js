import { postJson } from "../requests/post-json.js";
import { isRecord } from "../../payloads/is-record.js";
/** One request; archived rows leave the list through their own collection events (no workbench refetch). Never retried. */
export async function archiveProject(ctx, projectId) {
    if (!projectId) return null;
    const body = await postJson(ctx, `${ctx.apiRoot}/projects/${encodeURIComponent(projectId)}/archive`, { confirm: true });
    if (!isRecord(body) || body.projectId !== projectId || !Array.isArray(body.archived) || !Array.isArray(body.unarchived)) {
      throw new Error("项目归档结果未确认。");
    }
    return body;
  }

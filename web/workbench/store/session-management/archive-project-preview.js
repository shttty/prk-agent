import { getJson } from "../requests/get-json.js";
import { isRecord } from "../../payloads/is-record.js";
export async function archiveProjectPreview(ctx, projectId) {
    if (!projectId) return null;
    const body = await getJson(ctx, `${ctx.apiRoot}/projects/${encodeURIComponent(projectId)}/archive-preview`);
    if (!isRecord(body) || body.projectId !== projectId || !Array.isArray(body.sessions) || !Array.isArray(body.retained)) {
      throw new Error("服务未返回有效的项目归档预览。");
    }
    return body;
  }

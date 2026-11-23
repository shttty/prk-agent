import { getJson } from "../requests/get-json.js";
import { isRecord } from "../../payloads/is-record.js";
export async function archivePreview(ctx, name) {
    if (!name || !ctx.state.sessions.has(name)) return null;
    const body = await getJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/archive-preview`);
    if (!isRecord(body) || body.root !== name || !Array.isArray(body.sessions) || !Array.isArray(body.retained)) {
      throw new Error("服务未返回有效的归档预览。");
    }
    return body;
  }


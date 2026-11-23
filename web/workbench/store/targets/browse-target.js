import { postJson } from "../requests/post-json.js";
import { isRecord } from "../../payloads/is-record.js";
export async function browseTarget(ctx, connection, path) {
    const result = await postJson(ctx, `${ctx.apiRoot}/targets/browse`, { connection, path });
    if (!isRecord(result) || !Array.isArray(result.entries)) throw new Error("服务未返回有效的目录结果。");
    return result;
  }


import { postJson } from "../requests/post-json.js";
import { isRecord } from "../../payloads/is-record.js";
/** Tests an unsaved draft connection `{local,sshCommand?,python?,cwd?}`; with `python` the target also checks that interpreter's version. */
export async function inspectTarget(ctx, connection) {
    const result = await postJson(ctx, `${ctx.apiRoot}/targets/inspect`, { connection });
    if (!isRecord(result) || typeof result.hostname !== "string" || !Array.isArray(result.pythonCandidates)
      || (connection.python !== undefined && (!isRecord(result.python) || typeof result.python.version !== "string"))) throw new Error("服务未返回有效的验证结果。");
    return result;
  }

import type { InspectTargetResult, TargetConnection } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { postJson } from "../requests/post-json.ts";
import { isRecord } from "../../payloads/is-record.ts";

/** Tests an unsaved draft connection; with `python` the target also checks that interpreter's version. */
export async function inspectTarget(ctx: StoreContext, connection: TargetConnection): Promise<InspectTargetResult> {
  const result = await postJson(`${ctx.apiRoot}/targets/inspect`, { connection });
  if (!isRecord(result) || typeof result.hostname !== "string" || !Array.isArray(result.pythonCandidates)
    || (connection.python !== undefined && (!isRecord(result.python) || typeof result.python.version !== "string"))) throw new Error("服务未返回有效的验证结果。");
  return result as unknown as InspectTargetResult;
}

import type { EditableExecutionTarget } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { getJson } from "../requests/get-json.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { safeText } from "../../payloads/safe-text.ts";

export async function getTarget(ctx: StoreContext, id: string): Promise<EditableExecutionTarget> {
  const body = await getJson(`${ctx.apiRoot}/targets/${encodeURIComponent(id)}`);
  const target = isRecord(body) && isRecord(body.target) ? body.target : body;
  if (!isRecord(target) || safeText(target.id) !== id) throw new Error("服务未返回匹配的实例配置。");
  // External input boundary: the Gateway's instance config; its id was checked above.
  return target as unknown as EditableExecutionTarget;
}

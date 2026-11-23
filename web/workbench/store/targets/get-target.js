import { getJson } from "../requests/get-json.js";
import { isRecord } from "../../payloads/is-record.js";
import { safeText } from "../../payloads/safe-text.js";
export async function getTarget(ctx, id) {
    const body = await getJson(ctx, `${ctx.apiRoot}/targets/${encodeURIComponent(id)}`);
    const target = isRecord(body?.target) ? body.target : body;
    if (!isRecord(target) || safeText(target.id) !== id) throw new Error("服务未返回匹配的实例配置。");
    return target;
  }


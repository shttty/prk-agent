import type { AbsoluteListing, TargetConnection } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { postJson } from "../requests/post-json.ts";
import { isRecord } from "../../payloads/is-record.ts";

export async function browseTarget(ctx: StoreContext, connection: TargetConnection, path: string): Promise<AbsoluteListing> {
  const result = await postJson(`${ctx.apiRoot}/targets/browse`, { connection, path });
  if (!isRecord(result) || !Array.isArray(result.entries)) throw new Error("服务未返回有效的目录结果。");
  return result as unknown as AbsoluteListing;
}

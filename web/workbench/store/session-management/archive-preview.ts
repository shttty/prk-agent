import type { ArchivePreview } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { getJson } from "../requests/get-json.ts";
import { isRecord } from "../../payloads/is-record.ts";

export async function archivePreview(ctx: StoreContext, name: string): Promise<ArchivePreview | null> {
  if (!name || !ctx.state.sessions.has(name)) return null;
  const body = await getJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/archive-preview`);
  if (!isRecord(body) || body.root !== name || !Array.isArray(body.sessions) || !Array.isArray(body.retained)) {
    throw new Error("服务未返回有效的归档预览。");
  }
  // External input boundary: the Gateway's preview; root and lists were checked above.
  return body as unknown as ArchivePreview;
}

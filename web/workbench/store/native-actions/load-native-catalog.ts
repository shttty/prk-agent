import type { NativeCatalog } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { patchSession } from "../updates/patch-session.ts";
import { getJson } from "../requests/get-json.ts";
import { nativePath } from "./native-path.ts";
import { isRecord } from "../../payloads/is-record.ts";

export async function loadNativeCatalog(ctx: StoreContext, name = ctx.state.selectedSessionId, token = ctx.selectionToken) {
  if (!name) return;
  const clientId = ctx.state.session.extensionUiClientId;
  const current = () => token === ctx.selectionToken && clientId === ctx.state.session.extensionUiClientId && ctx.state.selectedSessionId === name;
  patchSession(ctx, { nativeCatalog: { ...ctx.state.session.nativeCatalog, loading: true, error: null } });
  try {
    const catalog = await getJson(nativePath(ctx, name));
    if (!current()) return;
    if (!isNativeCatalog(catalog)) throw new Error("读取命令目录失败。");
    patchSession(ctx, { nativeCatalog: { value: catalog, loading: false, error: null } });
  } catch (error) {
    if (current()) patchSession(ctx, { nativeCatalog: { ...ctx.state.session.nativeCatalog, loading: false, error: error instanceof Error ? error.message : "原生能力目录不可用。" } });
  }
}

/** The catalog is the Gateway's; the parts the store itself reads (commands, attachment limits) are checked here once. */
function isNativeCatalog(value: unknown): value is NativeCatalog {
  return isRecord(value) && Array.isArray(value.commands) && isRecord(value.attachments)
    && Number.isSafeInteger(value.attachments.maxItems) && Number.isSafeInteger(value.attachments.maxEncodedRequestBytes);
}

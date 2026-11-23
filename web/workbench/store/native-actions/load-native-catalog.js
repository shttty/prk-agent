import { patchSession } from "../updates/patch-session.js";
import { getJson } from "../requests/get-json.js";
import { nativePath } from "./native-path.js";
import { isRecord } from "../../payloads/is-record.js";
export async function loadNativeCatalog(ctx, name = ctx.state.selectedSessionId, token = ctx.selectionToken) {
    if (!name) return null;
    const clientId = ctx.state.session.extensionUiClientId;
    patchSession(ctx, { nativeCatalog: { ...ctx.state.session.nativeCatalog, loading: true, error: null } });
    try {
      const catalog = await getJson(ctx, nativePath(ctx, name));
      if (token !== ctx.selectionToken || clientId !== ctx.state.session.extensionUiClientId || ctx.state.selectedSessionId !== name) return null;
      if (!isRecord(catalog) || !Array.isArray(catalog.commands)) throw new Error("读取命令目录失败。");
      patchSession(ctx, { nativeCatalog: { value: catalog, loading: false, error: null } });
    } catch (error) {
      if (token === ctx.selectionToken && clientId === ctx.state.session.extensionUiClientId && ctx.state.selectedSessionId === name) patchSession(ctx, { nativeCatalog: { ...ctx.state.session.nativeCatalog, loading: false, error: error instanceof Error ? error.message : "原生能力目录不可用。" } });
    }
  }


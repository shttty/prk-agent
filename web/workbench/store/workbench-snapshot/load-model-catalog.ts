import type { ModelCatalog } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { patch } from "../updates/patch.ts";
import { getJson } from "../requests/get-json.ts";
import { isRecord } from "../../payloads/is-record.ts";

export async function loadModelCatalog(ctx: StoreContext) {
  patch(ctx, { modelCatalog: { ...ctx.state.modelCatalog, loading: true, error: null } });
  try {
    const catalog = await getJson(`${ctx.apiRoot}/models`);
    if (!isRecord(catalog) || !Array.isArray(catalog.models)) throw new Error("服务返回了无效的模型目录。");
    // External input boundary: the Gateway builds the model catalog; its models list was checked above, the rest is taken as sent.
    patch(ctx, { modelCatalog: { value: catalog as unknown as ModelCatalog, loading: false, error: null } });
  } catch (error) {
    patch(ctx, { modelCatalog: { value: null, loading: false, error: error instanceof Error ? error.message : "可用模型加载失败。" } });
  }
}

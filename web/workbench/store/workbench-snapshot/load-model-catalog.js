import { patch } from "../updates/patch.js";
import { getJson } from "../requests/get-json.js";
export async function loadModelCatalog(ctx) {
    patch(ctx, { modelCatalog: { ...ctx.state.modelCatalog, loading: true, error: null } });
    try {
      const catalog = await getJson(ctx, `${ctx.apiRoot}/models`);
      if (!Array.isArray(catalog?.models)) throw new Error("服务返回了无效的模型目录。");
      patch(ctx, { modelCatalog: { value: catalog, loading: false, error: null } });
    } catch (error) {
      patch(ctx, { modelCatalog: { value: null, loading: false, error: error instanceof Error ? error.message : "可用模型加载失败。" } });
    }
  }


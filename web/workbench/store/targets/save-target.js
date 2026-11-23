import { isRecord } from "../../payloads/is-record.js";
import { mutateWorkbench } from "../workbench-snapshot/mutate-workbench.js";
import { requestJson } from "../requests/request-json.js";
import { postJson } from "../requests/post-json.js";
/** Saves an instance: true when confirmed, otherwise the refusal (with its `code`/`details`) or false. */
export async function saveTarget(ctx, target, existingName = null) {
    if (!isRecord(target)) return false;
    let failure = null;
    const request = () => (existingName
      ? requestJson(ctx, `${ctx.apiRoot}/targets/${encodeURIComponent(existingName)}`, { method: "PATCH", body: JSON.stringify({ target }) })
      : postJson(ctx, `${ctx.apiRoot}/targets`, { target })).catch((error) => { failure = error; throw error; });
    const saved = await mutateWorkbench(ctx, "targetMutating", request, existingName ? "实例已保存。" : "实例已添加。", "实例保存失败。", "实例配置保存未确认。");
    return saved || failure || false;
  }

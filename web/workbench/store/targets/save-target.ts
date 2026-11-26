import type { EditableExecutionTarget } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { mutateWorkbench } from "../workbench-snapshot/mutate-workbench.ts";
import { requestJson } from "../requests/request-json.ts";
import { postJson } from "../requests/post-json.ts";

/** Saves an instance: true when confirmed, otherwise the refusal (with its `code`/`details`) or false. */
export async function saveTarget(ctx: StoreContext, target: Partial<EditableExecutionTarget>, existingName: string | null = null): Promise<boolean | Error> {
  const outcome: { failure?: Error } = {};
  const request = () => (existingName
    ? requestJson(`${ctx.apiRoot}/targets/${encodeURIComponent(existingName)}`, { method: "PATCH", body: JSON.stringify({ target }) })
    : postJson(`${ctx.apiRoot}/targets`, { target })).catch((error: unknown) => { if (error instanceof Error) outcome.failure = error; throw error; });
  const saved = await mutateWorkbench(ctx, "targetMutating", request, existingName ? "实例已保存。" : "实例已添加。", "实例保存失败。", "实例配置保存未确认。");
  return saved || outcome.failure || false;
}

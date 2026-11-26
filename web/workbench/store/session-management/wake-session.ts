import type { StoreContext } from "../store-context-types.ts";
import { postJson } from "../requests/post-json.ts";
import { RequestError } from "../requests/request-error.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { setError } from "../notices/set-error.ts";
import { setBanner } from "../notices/set-banner.ts";
import { safeText } from "../../payloads/safe-text.ts";

export async function wakeSession(ctx: StoreContext) {
  const { selectedSessionId: name, session: { streamId, snapshot } } = ctx.state;
  if (ctx.disposed || !name || !streamId || snapshot?.state !== "sleeping") return;
  const previous = ctx.wakeRequests.get(name);
  if (previous === null || previous === streamId) return;
  ctx.wakeRequests.set(name, null);
  const stillSleeping = () => !ctx.disposed && ctx.state.selectedSessionId === name
    && ctx.state.session.streamId === streamId && ctx.state.session.snapshot?.state === "sleeping";
  try {
    const result = await postJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/wake`, {});
    if (!isRecord(result) || result.sessionId !== name || result.sleeping !== false) throw new Error("服务未确认唤醒结果。");
    // Do not issue a second wake while the first success is waiting for its authoritative snapshot.
    if (stillSleeping()) ctx.wakeRequests.set(name, streamId);
  } catch (error) {
    if (!stillSleeping()) return;
    // A failed environment deployment: one sentence, the reason folded under the banner's details.
    if (error instanceof RequestError && error.code === "DEPLOYMENT_FAILED") setBanner(ctx, "环境准备失败，会话未唤醒。", "error", { kind: "send-rejected", stage: "wake", code: error.code, detail: safeText(error.details?.reason) || error.message });
    else setError(ctx, `无法唤醒会话：${error instanceof Error ? error.message : ""}`);
  } finally {
    if (ctx.wakeRequests.get(name) === null) ctx.wakeRequests.delete(name);
  }
}

import { postJson } from "../requests/post-json.js";
import { setError } from "../notices/set-error.js";

export async function wakeSession(ctx) {
  const { selectedSessionId: name, session: { streamId, snapshot } } = ctx.state;
  if (ctx.disposed || !name || !streamId || snapshot?.state !== "sleeping") return;
  const previous = ctx.wakeRequests.get(name);
  if (previous === null || previous === streamId) return;
  ctx.wakeRequests.set(name, null);
  const stillSleeping = () => !ctx.disposed && ctx.state.selectedSessionId === name
    && ctx.state.session.streamId === streamId && ctx.state.session.snapshot?.state === "sleeping";
  try {
    const result = await postJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/wake`, {});
    if (result?.sessionId !== name || result.sleeping !== false) throw new Error("服务未确认唤醒结果。");
    // Do not issue a second wake while the first success is waiting for its authoritative snapshot.
    if (stillSleeping()) ctx.wakeRequests.set(name, streamId);
  } catch (error) {
    if (stillSleeping()) setError(ctx, `无法唤醒会话：${error.message}`);
  } finally {
    if (ctx.wakeRequests.get(name) === null) ctx.wakeRequests.delete(name);
  }
}

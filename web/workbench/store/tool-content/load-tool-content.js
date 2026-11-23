import { getJson } from "../requests/get-json.js";
import { patchSession } from "../updates/patch-session.js";
export async function loadToolContent(ctx, toolCallId, { inputPreview, outputPreview } = {}, identity = { sessionId: ctx.state.selectedSessionId }) {
    const { sessionId } = identity;
    if (!sessionId) throw new Error("会话内容不可用。");
    const clientId = ctx.state.session.extensionUiClientId;
    const key = JSON.stringify([sessionId, toolCallId]);
    const matches = (value) => value && (!inputPreview || value.inputVersion === inputPreview.version) && (!outputPreview || value.outputVersion === outputPreview.version);
    const cached = ctx.state.session.toolContents.get(key);
    if (matches(cached)) return cached;
    let pending = ctx.toolContentRequests.get(key);
    if (!pending) {
      const query = new URLSearchParams({ toolCallId });
      pending = getJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(sessionId)}/tool-content?${query}`).then((value) => {
        if (value.sessionId !== sessionId || value.toolCallId !== toolCallId) throw new Error("工具内容不属于当前会话。");
        if (clientId === ctx.state.session.extensionUiClientId) patchSession(ctx, { toolContents: new Map(ctx.state.session.toolContents).set(key, value), transcriptRevision: ctx.state.session.transcriptRevision + 1 });
        return value;
      }).finally(() => { if (ctx.toolContentRequests.get(key) === pending) ctx.toolContentRequests.delete(key); });
      ctx.toolContentRequests.set(key, pending);
    }
    const value = await pending;
    if (!matches(value)) throw new Error("工具内容已更新，请重试。");
    return value;
  }


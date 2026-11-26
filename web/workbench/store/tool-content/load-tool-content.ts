import type { ToolContent, ToolContentPreview } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { getJson } from "../requests/get-json.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { patchSession } from "../updates/patch-session.ts";

type Previews = { inputPreview?: ToolContentPreview; outputPreview?: ToolContentPreview };

/** The full input and output of one tool call, cached per session and call; `previews` names the versions the caller shows. */
export async function loadToolContent(ctx: StoreContext, toolCallId: string, { inputPreview, outputPreview }: Previews = {}, identity: { sessionId: string | null } = { sessionId: ctx.state.selectedSessionId }): Promise<ToolContent> {
  const { sessionId } = identity;
  if (!sessionId) throw new Error("会话内容不可用。");
  const clientId = ctx.state.session.extensionUiClientId;
  const key = JSON.stringify([sessionId, toolCallId]);
  const matches = (value: ToolContent | undefined): value is ToolContent => value !== undefined && (!inputPreview || value.inputVersion === inputPreview.version) && (!outputPreview || value.outputVersion === outputPreview.version);
  const cached = ctx.state.session.toolContents.get(key);
  if (matches(cached)) return cached;
  let pending = ctx.toolContentRequests.get(key);
  if (!pending) {
    const query = new URLSearchParams({ toolCallId });
    const request: Promise<ToolContent> = getJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(sessionId)}/tool-content?${query}`).then((body) => {
      if (!isRecord(body) || body.sessionId !== sessionId || body.toolCallId !== toolCallId) throw new Error("工具内容不属于当前会话。");
      // The Gateway builds tool content; once it names this call it is taken as sent.
      const value = body as unknown as ToolContent;
      if (clientId === ctx.state.session.extensionUiClientId) patchSession(ctx, { toolContents: new Map(ctx.state.session.toolContents).set(key, value), transcriptRevision: ctx.state.session.transcriptRevision + 1 });
      return value;
    }).finally(() => { if (ctx.toolContentRequests.get(key) === request) ctx.toolContentRequests.delete(key); });
    pending = request;
    ctx.toolContentRequests.set(key, request);
  }
  const value = await pending;
  if (!matches(value)) throw new Error("工具内容已更新，请重试。");
  return value;
}

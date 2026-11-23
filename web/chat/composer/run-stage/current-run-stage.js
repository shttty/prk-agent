import { isBusy } from "../../conversation/is-busy.js";
import { toolTitle } from "../../transcript/tool-calls/tool-title.js";
/**
 * What the selected session is doing right now, as `{stage, text}`: sending until the Gateway admits the request,
 * then the operation's live stage (waiting for the model by default). Null when idle.
 */
export function currentRunStage(state) {
  if (state.session.pending.has("sending")) return { stage: "sending", text: "发送中…" };
  if (!isBusy(state)) return null;
  const record = state.session.runStage;
  if (record?.stage === "thinking") return { stage: "thinking", text: "思考中…" };
  if (record?.stage === "output") return { stage: "output", text: "输出中…" };
  if (record?.stage === "tool") return { stage: "tool", text: `调用工具 · ${toolTitle(record.tools.at(-1)?.name)}` };
  if (record?.stage === "retry") return { stage: "retry", text: `重试中（第 ${record.attempt} 次）…` };
  return { stage: "waiting", text: "等待模型响应…" };
}

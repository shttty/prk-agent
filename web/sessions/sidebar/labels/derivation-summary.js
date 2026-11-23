import { sessionLabelById } from "./session-label-by-id.js";
import { text } from "../text.js";
export function derivationSummary(sessionRow, sessions) {
  const derivation = sessionRow?.derivation;
  if (!derivation || typeof derivation !== "object") return "来源 独立会话 · 管理 用户";
  const origin = sessionLabelById(sessions, derivation.createdBy);
  const owner = derivation.owner ? sessionLabelById(sessions, derivation.owner) : "用户";
  const model = text(derivation.model).trim();
  const thinking = text(derivation.thinkingLevel).trim();
  const lifecycle = text(derivation.lifecycle).trim();
  const phase = text(derivation.phase).trim();
  const modelInfo = model ? `${model}${thinking ? ` · ${thinking}` : ""}` : thinking;
  return `派生 · 来源 ${origin} · 管理 ${owner}${lifecycle || phase ? ` · ${lifecycle || "—"}/${phase || "—"}` : ""}${modelInfo ? ` · ${modelInfo}` : ""}`;
}

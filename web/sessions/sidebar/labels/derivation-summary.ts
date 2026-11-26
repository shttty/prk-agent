import type { SessionRow, SessionRows } from "../../../workbench/store/store-types.ts";
import { sessionLabelById } from "./session-label-by-id.ts";

export function derivationSummary(sessionRow: SessionRow, sessions: SessionRows): string {
  const derivation = sessionRow.derivation;
  if (!derivation) return "来源 独立会话 · 管理 用户";
  const origin = sessionLabelById(sessions, derivation.createdBy);
  const owner = derivation.owner ? sessionLabelById(sessions, derivation.owner) : "用户";
  const model = derivation.model.trim();
  const thinking = derivation.thinkingLevel.trim();
  const { lifecycle, phase } = derivation;
  const modelInfo = model ? `${model}${thinking ? ` · ${thinking}` : ""}` : thinking;
  return `派生 · 来源 ${origin} · 管理 ${owner} · ${lifecycle}/${phase}${modelInfo ? ` · ${modelInfo}` : ""}`;
}

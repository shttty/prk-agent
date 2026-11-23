import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { PersistedThinkingLevel } from "../history-types.ts";
import { modelSpec } from "./validate-model-spec.ts";
import { invalid } from "../reject-invalid-history.ts";
import { thinkingLevel } from "./validate-thinking-level.ts";

export function activeModelAndThinking(
  manager: SessionManager,
  limits: LimitsOptions,
  fallbackModel?: string,
  fallbackThinking?: PersistedThinkingLevel,
): { readonly model?: string; readonly thinkingLevel?: PersistedThinkingLevel } {
  const context = manager.buildSessionContext();
  let model = fallbackModel;
  if (context.model !== null) {
    const candidate = `${context.model.provider}/${context.model.modelId}`;
    if (!modelSpec(candidate, limits)) invalid("native model state at /model");
    model = candidate;
  }
  let effectiveThinkingLevel = fallbackThinking;
  if (manager.getBranch().some((entry) => entry.type === "thinking_level_change")) {
    if (!thinkingLevel(context.thinkingLevel)) invalid("native thinking state at /thinkingLevel");
    effectiveThinkingLevel = context.thinkingLevel;
  }
  return {
    ...(model === undefined ? {} : { model }),
    ...(effectiveThinkingLevel === undefined ? {} : { thinkingLevel: effectiveThinkingLevel }),
  };
}

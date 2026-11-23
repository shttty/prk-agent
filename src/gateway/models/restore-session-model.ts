import { clampThinkingLevel } from "@earendil-works/pi-ai";
import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { HostContext } from "../host/host-state.ts";
import type { SessionRuntimeDependencies } from "../../sessions/runtime/runtime-types.ts";
import type { NativeSessionState } from "../../sessions/history/history-types.ts";
import type { DerivedSessionInfo } from "../../plugins/sessions/session-types.ts";
import { selectDerivationModel } from "../../config/derivation/select-model.ts";

export function restoreSessionModel(ctx: HostContext, sessionId: string, base: SessionRuntimeDependencies, manager: SessionManager | undefined, native: NativeSessionState, derived?: DerivedSessionInfo) {
  const spec = native.model ?? derived?.model;
  if (!spec) return undefined;
  const separator = spec.indexOf("/");
  const model = separator > 0 ? base.modelRuntime.getModel(spec.slice(0, separator), spec.slice(separator + 1)) : undefined;
  const available = model && base.modelRuntime.getAvailableSnapshot().some((entry) => entry.provider === model.provider && entry.id === model.id);
  if (available) return native.model === undefined && derived
    ? selectDerivationModel({}, { lifecycle: derived.lifecycle, model: derived.model, thinkingLevel: derived.thinkingLevel }, base, base.modelRuntime)
    : { model, thinkingLevel: native.thinkingLevel ?? base.thinkingLevel };
  const fallback = base.model;
  const fallbackSpec = `${fallback.provider}/${fallback.id}`;
  if (!base.modelRuntime.getAvailableSnapshot().some((entry) => entry.provider === fallback.provider && entry.id === fallback.id)) throw new Error(`Default session model ${JSON.stringify(fallbackSpec)} is unavailable.`);
  const thinkingLevel = clampThinkingLevel(fallback, native.thinkingLevel ?? derived?.thinkingLevel ?? base.thinkingLevel);
  manager!.appendModelChange(fallback.provider, fallback.id);
  if (thinkingLevel !== native.thinkingLevel) manager!.appendThinkingLevelChange(thinkingLevel);
  const notice = { previousModel: spec, model: fallbackSpec, reason: `原模型 ${spec} 不可用，已改用默认模型 ${fallbackSpec}。` };
  ctx.models.modelFallbacks.set(sessionId, notice);
  console.error(`[${new Date().toISOString()}] Session ${sessionId}: ${notice.reason}`);
  return { model: fallback, thinkingLevel };
}

import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { requireActiveSession } from "../dispatch/require-active-session.ts";
import { argumentText } from "../dispatch/read-text-argument.ts";
import { THINKING_LEVELS } from "../native-constants.ts";
import { appendNativeSessionState } from "../../history/append-native-session-state.ts";
import { availableModel } from "./select-available-model.ts";
import { readNativeSessionState } from "../../history/read-native-session-state.ts";

export function setThinking(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest) {
  const session = target.state === "sleeping" && !target.readOnly ? undefined : requireActiveSession(target);
  const persisted = session ? undefined : readNativeSessionState(target.manager, ctx.limits);
  const activeModel = session?.model ?? (persisted?.model ? availableModel(target, persisted.model) : undefined);
  const level = argumentText(request.args, "level");
  if (!activeModel || !level || !THINKING_LEVELS.has(level) || !(getSupportedThinkingLevels(activeModel) as readonly string[]).includes(level)) throw new WireError("INVALID_REQUEST", "Thinking action requires a level supported by the active model.");
  if (session) {
    session.setThinkingLevel(level as AgentSession["thinkingLevel"], { persist: false });
    appendNativeSessionState(target, session);
  } else {
    if (persisted?.thinkingLevel !== level) target.manager.appendThinkingLevelChange(level);
    appendNativeSessionState(target, persisted!);
  }
  return { thinkingLevel: level };
}

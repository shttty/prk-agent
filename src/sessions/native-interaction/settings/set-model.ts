import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { requireActiveSession } from "../dispatch/require-active-session.ts";
import { argumentText } from "../dispatch/read-text-argument.ts";
import { appendNativeSessionState } from "../../history/append-native-session-state.ts";
import { availableModel } from "./select-available-model.ts";
import { readNativeSessionState } from "../../history/read-native-session-state.ts";
import { clampThinkingLevel } from "@earendil-works/pi-ai";

export async function setModel(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest) {
  const session = target.state === "sleeping" && !target.readOnly ? undefined : requireActiveSession(target);
  const spec = argumentText(request.args, "model");
  if (!spec || !spec.includes("/")) throw new WireError("INVALID_REQUEST", "Model action requires PROVIDER/MODEL.");
  const selected = availableModel(target, spec);
  if (session) {
    await session.setModel(selected, { persist: false });
    appendNativeSessionState(target, session);
    target.onModelChange?.();
    return { model: spec, thinkingLevel: session.thinkingLevel };
  }
  const runtime = target.modelRuntime!;
  if (!await runtime.checkAuth(selected.provider)) throw new WireError("INVALID_REQUEST", `No API key for ${spec}`);
  const persisted = readNativeSessionState(target.manager, ctx.limits);
  const thinkingLevel = clampThinkingLevel(selected, persisted.thinkingLevel ?? "medium");
  target.manager.appendModelChange(selected.provider, selected.id);
  if (thinkingLevel !== persisted.thinkingLevel) target.manager.appendThinkingLevelChange(thinkingLevel);
  appendNativeSessionState(target, persisted);
  target.onModelChange?.();
  return { model: spec, thinkingLevel };
}

import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { requireIdle } from "../dispatch/require-idle-session.ts";
import { appendNativeSessionState } from "../../history/append-native-session-state.ts";
import { availableModel } from "./select-available-model.ts";
import { readNativeSessionState } from "../../history/read-native-session-state.ts";

export function setScopedModels(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest) {
  const { limits } = ctx;
  const session = target.state === "sleeping" && !target.readOnly ? undefined : requireIdle(target);
  const raw = request.args?.models;
  const models = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\s+/u) : [];
  if (!models.length || models.some((value) => typeof value !== "string" || !value.includes("/"))) throw new WireError("INVALID_REQUEST", "scoped-models requires one or more PROVIDER/MODEL values.");
  if (models.length > limits.scopedModelsMax) throw new WireError("INVALID_REQUEST", `scoped-models supports at most ${limits.scopedModelsMax} models; no scope was changed.`);
  const selected = models.map((value) => ({ model: availableModel(target, value as string) }));
  if (session) {
    session.setScopedModels(selected);
    appendNativeSessionState(target, session);
  } else appendNativeSessionState(target, readNativeSessionState(target.manager, limits), models as string[]);
  return { models };
}

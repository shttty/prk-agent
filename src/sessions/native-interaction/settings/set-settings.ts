import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { requireIdle } from "../dispatch/require-idle-session.ts";
import { appendNativeSessionState } from "../../history/append-native-session-state.ts";
import { setting } from "./parse-setting-value.ts";

export function setSettings(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest) {
  const session = requireIdle(target);
  const args = request.args ?? {};
  if (Object.keys(args).some((key) => !["autoCompaction", "autoRetry", "showImages"].includes(key))) throw new WireError("INVALID_REQUEST", "Settings keys are autoCompaction, autoRetry, or showImages.");
  const autoCompaction = setting(args, "autoCompaction");
  const autoRetry = setting(args, "autoRetry");
  const showImages = setting(args, "showImages");
  if (autoCompaction !== undefined || autoRetry !== undefined) {
    if (autoCompaction !== undefined) session.setAutoCompactionEnabled(autoCompaction);
    if (autoRetry !== undefined) session.setAutoRetryEnabled(autoRetry);
    appendNativeSessionState(target, session);
  }
  return { model: session.model ? `${session.model.provider}/${session.model.id}` : undefined, thinkingLevel: session.thinkingLevel, scopedModels: session.scopedModels.map((entry) => `${entry.model.provider}/${entry.model.id}`), autoCompaction: session.autoCompactionEnabled, autoRetry: session.autoRetryEnabled, showImages: showImages === undefined ? { scope: "web-presentation", instruction: "The browser owns image rendering preference; no Gateway setting was changed." } : { scope: "web-presentation", requested: showImages, instruction: "Apply this presentation preference in the browser; no Gateway setting was changed." }, scope: "current-session" };
}

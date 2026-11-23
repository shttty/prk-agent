import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { result } from "../dispatch/format-action-result.ts";

export async function setKernelLanguage(target: NativeTarget, request: NativeActionRequest): Promise<NativeActionResult> {
  try {
    const language = request.args?.language;
    if (Object.keys(request.args ?? {}).length !== 1 || (language !== "python" && language !== "bun")) throw new WireError("INVALID_REQUEST", "Expected only language: python or bun.");
    if (target.readOnly || !target.setKernelLanguage) throw new WireError("UNAVAILABLE", "This session cannot change kernel language.");
    if (target.state !== "idle") throw new WireError("BUSY", "Session must be idle to change kernel language.");
    const change = await target.setKernelLanguage(language);
    return result(request, "completed", change.status === "changed" ? "Kernel language changed; the next cell starts with an empty namespace." : "Kernel language unchanged.", change);
  } catch (error) {
    if (error instanceof Error) {
      const code = "code" in error ? error.code : "UNAVAILABLE";
      const details = "details" in error ? error.details : undefined;
      return result(request, "failed", error.message, { code, ...(details && typeof details === "object" ? details : {}) });
    }
    throw error;
  }
}

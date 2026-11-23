import type { KernelContext } from "../kernel-state.ts";
import type { KernelDiagnostics } from "../kernel-types.ts";
import { publish } from "./publish.ts";

export function captureDiagnostic(ctx: KernelContext, stream: "stdout" | "stderr", text: string): void {
  if (!text) return;
  const previous: KernelDiagnostics = ctx.snapshot.diagnostics ?? { stdout: "", stderr: "", truncated: false };
  const limit = ctx.options.maxOutputChars;
  const cut = previous[stream].length + text.length - limit;
  let kept = cut >= previous[stream].length
    ? text.slice(-limit)
    : previous[stream].slice(Math.max(0, cut)) + text;
  if (cut > 0 && /^[\uDC00-\uDFFF]/u.test(kept)) kept = kept.slice(1);
  publish(ctx, { diagnostics: { ...previous, [stream]: kept, truncated: previous.truncated || cut > 0 } });
}

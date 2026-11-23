import { mergeLiveKernel } from "./merge-live-kernel.js";
import { patchSession } from "../updates/patch-session.js";
/**
 * A kernel-only `state_changed` frame (memory/telemetry, about once a second while a cell runs): replaces
 * `snapshot.kernel` and `lastSequence`, display-only (batched to the next frame). Only components that select the
 * kernel re-render; the frame does not bump `snapshot.sequence`, so it never invalidates plugin rendering.
 */
export function applyKernelTelemetry(ctx, event) {
  const session = ctx.state.session;
  const snapshot = session.snapshot && { ...session.snapshot, kernel: mergeLiveKernel(session.snapshot.kernel, event.details.kernel),
    ...(Array.isArray(event.details.kernelCells) ? { kernelCells: event.details.kernelCells } : {}) };
  patchSession(ctx, { lastSequence: event.sequence, snapshot }, { displayOnly: true });
}

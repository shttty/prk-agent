import type { StoreContext } from "../store-context-types.ts";
import type { StateChange } from "./session-stream-types.ts";
import { mergeLiveKernel } from "./merge-live-kernel.ts";
import { patchSession } from "../updates/patch-session.ts";

/**
 * A kernel-only `state_changed` frame (memory/telemetry, about once a second while a cell runs): replaces
 * `snapshot.kernel` and `lastSequence`, display-only (batched to the next frame). Only components that select the
 * kernel re-render; the frame does not bump `snapshot.sequence`, so it never invalidates plugin rendering.
 */
export function applyKernelTelemetry(ctx: StoreContext, sequence: number, change: StateChange) {
  const current = ctx.state.session.snapshot;
  const snapshot = current && change.kernel
    ? { ...current, kernel: mergeLiveKernel(current.kernel, change.kernel), ...(change.kernelCells ? { kernelCells: change.kernelCells } : {}) }
    : current;
  patchSession(ctx, { lastSequence: sequence, snapshot }, { displayOnly: true });
}

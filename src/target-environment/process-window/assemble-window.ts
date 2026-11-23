import { parseProcessWindowLimits } from "./parse-limits.ts";
import type { ProcessWindow, ProcessWindowLimits, ProcessWindowState } from "./window-state.ts";
import { reserve } from "./reserve.ts";
import { confirm } from "./confirm.ts";
import { retire } from "./retire.ts";
import { waitForControl } from "./wait-for-control.ts";

export function createProcessWindow<Control extends string = never>(
  options: Partial<ProcessWindowLimits> = {}, controlReserves?: Readonly<Record<Control, number>>,
): ProcessWindow<Control> {
  const limits = parseProcessWindowLimits(options);
  let controls: ProcessWindowState["controls"];
  let { maxRequests, maxBytes } = limits;
  if (controlReserves !== undefined) {
    controls = new Map();
    // Ordinary traffic cannot borrow unused slots or bytes from either control kind.
    for (const kind of Object.keys(controlReserves) as Control[]) {
      const bytes = controlReserves[kind];
      if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > limits.maxFrameBytes) {
        throw invalidBudget(`${kind} reserve must be a positive byte count within maxFrameBytes (${limits.maxFrameBytes}).`);
      }
      controls.set(kind, { maxBytes: bytes, bytes: 0 });
      maxRequests--;
      maxBytes -= bytes;
      if (maxRequests < 1) {
        throw invalidBudget(`maxRequests (${limits.maxRequests}) must leave a slot for ordinary commands after control reserves.`);
      }
      if (maxBytes < 1) {
        throw invalidBudget(`maxBytes (${limits.maxBytes}) must leave bytes for ordinary commands after control reserves.`);
      }
    }
  }
  const ctx: ProcessWindowState = {
    ordinaryLimits: controls ? { maxRequests, maxBytes, maxFrameBytes: limits.maxFrameBytes } : limits,
    controls, pending: new Map(), ordinaryRequests: 0, ordinaryBytes: 0, retired: false,
  };
  return {
    reserve: (id, bytes, control) => reserve(ctx, id, bytes, control),
    waitForControl: (control, signal) => waitForControl(ctx, control, signal),
    confirm: (id: number) => confirm(ctx, id),
    retire: (reason) => retire(ctx, reason),
    snapshot: () => {
      let bytes = ctx.ordinaryBytes;
      if (controls) for (const slot of controls.values()) bytes += slot.bytes;
      return { requests: ctx.pending.size, bytes };
    },
  };
}

function invalidBudget(reason: string): Error {
  return Object.assign(new Error(`Invalid processWindow control budget: ${reason}`), { code: "INVALID_REQUEST" });
}

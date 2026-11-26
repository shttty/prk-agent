import { stallsTotal } from "../instruments/event-loop-instruments.ts";

export interface StallFields {
  /** `plugin_hook`, `event_loop`, or a serialization kind such as `history_load`. */
  readonly kind: string;
  readonly durationMs: number;
  readonly sessionId?: string | undefined;
  readonly plugin?: string;
  readonly event?: string;
  readonly bytes?: number;
  readonly detail?: string;
}

/** One greppable line per stall; the timestamp is when the stall ended (event_loop: when its window ended). */
export function reportStall(fields: StallFields): void {
  stallsTotal.inc({ kind: fields.kind });
  const parts = [`kind=${fields.kind}`];
  if (fields.plugin !== undefined) parts.push(`plugin=${JSON.stringify(fields.plugin)}`, `event=${fields.event}`);
  parts.push(`sessionId=${fields.sessionId ?? "-"}`, `durationMs=${Math.round(fields.durationMs)}`, `bytes=${fields.bytes ?? "-"}`);
  if (fields.detail) parts.push(fields.detail);
  console.error(`[${new Date().toISOString()}] WARN Gateway stall ${parts.join(" ")}`);
}

import { serializationBytes, serializationSeconds } from "../instruments/section-instruments.ts";
import { reportStall } from "../stall/report-stall.ts";
import { stallSettings } from "../stall/stall-settings.ts";

/** `started` is a `performance.now()` taken right before the serialization or load; `kind` must stay a small fixed set. */
export function recordSerialization(kind: string, started: number, bytes: number, sessionId: () => string | undefined): void {
  const milliseconds = performance.now() - started;
  serializationSeconds.observe({ kind }, milliseconds / 1000);
  serializationBytes.observe({ kind }, bytes);
  if (milliseconds >= stallSettings.thresholdMs) reportStall({ kind, sessionId: sessionId(), durationMs: milliseconds, bytes });
}

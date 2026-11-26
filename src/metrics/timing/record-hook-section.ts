import { hookSyncSeconds } from "../instruments/section-instruments.ts";
import { reportStall } from "../stall/report-stall.ts";
import { stallSettings } from "../stall/stall-settings.ts";

/** `started` is a `performance.now()` taken right before the handler call; call this right after it returns. */
export function recordHookSection(plugin: string, event: string, sessionId: () => string | undefined, started: number): void {
  const milliseconds = performance.now() - started;
  hookSyncSeconds.observe({ plugin, event }, milliseconds / 1000);
  if (milliseconds >= stallSettings.thresholdMs) reportStall({ kind: "plugin_hook", plugin, event, sessionId: sessionId(), durationMs: milliseconds });
}

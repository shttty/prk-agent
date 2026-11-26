import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { eventLoopDelaySeconds, eventLoopUtilization, eventLoopWindowMaxSeconds } from "../instruments/event-loop-instruments.ts";
import { reportStall } from "../stall/report-stall.ts";
import { stallSettings } from "../stall/stall-settings.ts";

const NANOSECONDS = 1e9;

/** Reads and resets the delay histogram every window, so each reading covers only that window. */
export function startEventLoopSampler(windowMs: number): { close(): void } {
  const delay = monitorEventLoopDelay({ resolution: 10 });
  delay.enable();
  let previous = performance.eventLoopUtilization();
  const timer = setInterval(() => {
    const current = performance.eventLoopUtilization();
    eventLoopUtilization.set(performance.eventLoopUtilization(current, previous).utilization);
    previous = current;
    if (delay.count > 0) {
      const max = delay.max / NANOSECONDS;
      eventLoopDelaySeconds.set({ stat: "p50" }, delay.percentile(50) / NANOSECONDS);
      eventLoopDelaySeconds.set({ stat: "p99" }, delay.percentile(99) / NANOSECONDS);
      eventLoopDelaySeconds.set({ stat: "max" }, max);
      eventLoopWindowMaxSeconds.observe(max);
      if (max * 1000 >= stallSettings.thresholdMs) {
        reportStall({ kind: "event_loop", durationMs: max * 1000, detail: `p99Ms=${Math.round(delay.percentile(99) / 1e6)} windowMs=${windowMs}` });
      }
    }
    delay.reset();
  }, windowMs);
  timer.unref();
  return { close: () => { clearInterval(timer); delay.disable(); } };
}

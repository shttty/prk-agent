import type { MonitoredRow } from "./monitor-types.ts";

export function alertsOf({ monitor }: MonitoredRow) {
  const kernel = monitor?.alerts.kernel === true;
  const oom = monitor?.alerts.oom === true;
  const memory = monitor?.alerts.memory === true;
  return { kernel, oom, memory, any: kernel || oom || memory };
}

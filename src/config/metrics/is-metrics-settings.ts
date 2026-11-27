import { isIP } from "node:net";
import { METRICS_SETTINGS_PORTS, type MetricsSettings } from "./metrics-options.ts";

export function isMetricsSettings(value: unknown): value is MetricsSettings {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const { enabled, port, host, ...extra } = value as Record<string, unknown>;
  return Object.keys(extra).length === 0 && typeof enabled === "boolean"
    && (host === undefined || (typeof host === "string" && isIP(host) !== 0)) && typeof port === "number" && Number.isInteger(port) && port >= METRICS_SETTINGS_PORTS.min && port <= METRICS_SETTINGS_PORTS.max;
}

import { METRIC_FIELDS, MAX_TIMER_MS, type CustomMetric } from "./custom-metrics-options.ts";
import { invalid } from "./reject-invalid-metric.ts";

/** Validate custom commands once, at the instance configuration boundary. */
export function parseCustomMetrics(value: unknown): readonly CustomMetric[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) invalid("must be an array");
  const names = new Set<string>();
  return Object.freeze(value.map((entry, index): CustomMetric => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) invalid(`item ${index} must be an object`);
    if (Object.keys(entry).some((key) => METRIC_FIELDS[key] !== true)) {
      invalid(`item ${index} contains an unsupported field`);
    }
    if (typeof entry.name !== "string" || entry.name.trim().length === 0) invalid(`item ${index} requires a non-empty name`);
    const name = entry.name.trim();
    if (names.has(name)) invalid("names must be unique");
    names.add(name);
    if (typeof entry.command !== "string" || entry.command.trim().length === 0 || entry.command.includes("\0")) {
      invalid(`item ${index} requires a non-empty command without NUL`);
    }
    if (typeof entry.interval_s !== "number" || !Number.isFinite(entry.interval_s)
      || entry.interval_s <= 0 || entry.interval_s * 1000 > MAX_TIMER_MS) {
      invalid(`item ${index} interval_s must be positive, finite, and at most ${MAX_TIMER_MS / 1000}`);
    }
    if (typeof entry.parse !== "string" || (entry.parse !== "number"
      && (!entry.parse.startsWith("json:") || entry.parse.slice(5).split(".").some((segment: string) => segment.length === 0)))) {
      invalid(`item ${index} parse must be number or json:<non-empty dot-path>`);
    }
    if (entry.unit !== undefined && typeof entry.unit !== "string") invalid(`item ${index} unit must be a string`);
    if (entry.chart !== undefined && entry.chart !== "line") invalid(`item ${index} chart must be line`);
    return Object.freeze({
      name,
      command: entry.command,
      interval_s: entry.interval_s,
      parse: entry.parse,
      ...(entry.unit === undefined ? {} : { unit: entry.unit }),
      ...(entry.chart === undefined ? {} : { chart: entry.chart }),
    });
  }));
}

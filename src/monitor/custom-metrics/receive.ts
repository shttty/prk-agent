import type { TargetEvent } from "../../target-channel/channels/channel-types.ts";
import type { CustomMetricsContext } from "./custom-metrics-state.ts";

export function receive(ctx: CustomMetricsContext, event: TargetEvent, at: number): boolean {
  if (event.t !== "metric") return false;
  const rec = ctx.records.get(event.name as string);
  if (!rec) return false;
  const value = { value: event.value as number | null, error: event.error as string | null };
  rec.sample = { at, value };
  rec.history.push(at, value);
  return true;
}

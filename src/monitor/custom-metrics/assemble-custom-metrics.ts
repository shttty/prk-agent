import type { CustomMetric } from "../../config/custom-metrics/custom-metrics-options.ts";
import type { MonitorOptions } from "../../config/monitor/monitor-options.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import type { TargetEvent } from "../../target-channel/channels/channel-types.ts";
import type { CustomMetricsContext } from "./custom-metrics-state.ts";
import type { MetricSeries, MetricView } from "./custom-metrics-types.ts";
import { sync } from "./sync.ts";
import { reset } from "./reset.ts";
import { receive } from "./receive.ts";
import { view } from "./read-view.ts";
import { history } from "./history.ts";

/** Transient command results only; definitions always come from the loaded instance config. */
export class CustomMetricStore {
  sync: (lease: TargetLease, metrics: readonly CustomMetric[], leaseMs: number) => Promise<unknown> | undefined;
  reset: () => void;
  receive: (event: TargetEvent, at: number) => boolean;
  view: () => readonly MetricView[];
  history: (now: number) => readonly MetricSeries[];

  constructor(options: MonitorOptions) {
    const ctx: CustomMetricsContext = { options, records: new Map(), definitions: undefined, configured: "" };
    this.sync = sync.bind(null, ctx);
    this.reset = reset.bind(null, ctx);
    this.receive = receive.bind(null, ctx);
    this.view = view.bind(null, ctx);
    this.history = history.bind(null, ctx);
  }
}

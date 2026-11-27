import type { MetricsListener } from "../../metrics/endpoint/start-metrics-listener.ts";

export interface MetricsState {
  /** Stops the event-loop sampler and unbinds the session gauge. */
  close(): void;
  /** The loopback listener while it is up; closed with the host. */
  listener?: MetricsListener;
  /** Why enabled metrics are not served: the bind failure at startup. Cleared by the next successful set. */
  failure?: string;
}

import { Gauge, Histogram } from "prom-client";
import { gatewayRegistry } from "../registry/gateway-registry.ts";

/** Set by the Gateway host that owns the live session collection; read on every scrape. */
export const sessionStates: { read: (() => Readonly<Record<string, number>>) | undefined } = { read: undefined };

export const sessionsGauge = new Gauge({
  name: "prk_sessions",
  help: "Sessions held by the Gateway's session collection, by state. No per-session series exist.",
  labelNames: ["state"], registers: [gatewayRegistry],
  collect() {
    this.reset();
    for (const [state, count] of Object.entries(sessionStates.read?.() ?? {})) this.set({ state }, count);
  },
});

export const modelRequestsInFlight = new Gauge({
  name: "prk_model_requests_in_flight",
  help: "Model requests sent and not yet finished, by provider.",
  labelNames: ["provider"], registers: [gatewayRegistry],
});

export const modelRequestSeconds = new Histogram({
  name: "prk_model_request_seconds",
  help: "Wall time from sending a model request to its finished assistant message, by provider and outcome (ok, error, aborted). The model name is not a label.",
  labelNames: ["provider", "outcome"],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300, 600], registers: [gatewayRegistry],
});

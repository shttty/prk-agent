import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { modelRequestSeconds, modelRequestsInFlight } from "../../metrics/instruments/session-instruments.ts";

/**
 * Times each model request and counts the ones in flight. Registered after every other extension, so its
 * `context_with_system` runs last, right before the request goes out (`before_provider_request` is skipped by
 * providers that build no payload). Series carry the provider only: session ids and model names would make
 * the cardinality unbounded.
 */
export function bindModelRequestMetrics(): ExtensionFactory {
  return (pi) => {
    let sent: { readonly provider: string; readonly at: number } | undefined;
    const finish = (outcome?: string) => {
      if (!sent) return;
      modelRequestsInFlight.dec({ provider: sent.provider });
      if (outcome) modelRequestSeconds.observe({ provider: sent.provider, outcome }, (performance.now() - sent.at) / 1000);
      sent = undefined;
    };
    pi.on("context_with_system", (_event, ctx) => {
      finish();
      sent = { provider: ctx.model?.provider ?? "unknown", at: performance.now() };
      modelRequestsInFlight.inc({ provider: sent.provider });
    });
    pi.on("message_end", (event) => {
      if (event.message.role !== "assistant") return;
      const { stopReason } = event.message;
      finish(stopReason === "error" ? "error" : stopReason === "aborted" ? "aborted" : "ok");
    });
    pi.on("session_shutdown", () => finish());
  };
}

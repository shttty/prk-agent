import { METRICS_HOST } from "./start-metrics-listener.ts";

/** One sentence for the log and the settings page when the loopback listener cannot bind. */
export function explainBindFailure(port: number, error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EADDRINUSE") return `Metrics port ${port} is already in use.`;
  return `Metrics cannot listen on ${METRICS_HOST}:${port} (${code ?? (error instanceof Error ? error.message : String(error))}).`;
}

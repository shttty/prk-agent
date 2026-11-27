/** One sentence for the log and the settings page when the listener cannot bind. */
export function explainBindFailure(host: string, port: number, error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EADDRINUSE") return `Metrics port ${port} is already in use.`;
  return `Metrics cannot listen on ${host}:${port} (${code ?? (error instanceof Error ? error.message : String(error))}).`;
}



export function log(sessionId: string, event: string): void {
  console.error(`[${new Date().toISOString()}] session ${sessionId}: ${event}`);
}

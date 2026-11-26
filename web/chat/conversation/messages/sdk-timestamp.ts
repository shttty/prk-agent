export function sdkTimestamp(message: { timestamp?: unknown } | undefined): { sdkTimestamp?: number } {
  const value = Number(message?.timestamp);
  return Number.isFinite(value) && value > 0 ? { sdkTimestamp: value } : {};
}

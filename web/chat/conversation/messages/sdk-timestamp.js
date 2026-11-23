
export function sdkTimestamp(message) {
  const value = Number(message?.timestamp);
  return Number.isFinite(value) && value > 0 ? { sdkTimestamp: value } : {};
}

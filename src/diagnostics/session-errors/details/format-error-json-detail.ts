export function jsonDetail(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    return typeof text === "string" ? text : String(value);
  } catch {
    return String(value);
  }
}

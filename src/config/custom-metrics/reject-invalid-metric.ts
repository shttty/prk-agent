export function invalid(detail: string): never {
  throw new Error(`Invalid instance configuration: customMetrics ${detail}.`);
}

export function invalid(detail: string): never {
  throw new Error(`Invalid session history ${detail}.`);
}

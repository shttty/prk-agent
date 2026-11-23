

export function invalid(detail: string): never {
  throw new Error(`Invalid derivation configuration: ${detail}.`);
}

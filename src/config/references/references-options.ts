export interface ReferencesOptions {
  readonly maxBytes: number;
  readonly maxEntries: number;
  readonly listingBytes: number;
  readonly timeoutMs: number;
}

export const DEFAULT_REFERENCES_OPTIONS: ReferencesOptions = Object.freeze({
  maxBytes: 262144,
  maxEntries: 1000,
  listingBytes: 262144,
  timeoutMs: 10000,
});

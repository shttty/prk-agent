export interface NamespaceOptions {
  readonly maxEntries: number;
  readonly maxChars: number;
  readonly docstringChars: number;
}

export const DEFAULT_NAMESPACE_OPTIONS: NamespaceOptions = Object.freeze({
  maxEntries: 100,
  maxChars: 16000,
  docstringChars: 300,
});

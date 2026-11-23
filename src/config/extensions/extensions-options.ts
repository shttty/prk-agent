
export interface ExtensionResourceFilter {
  readonly packages: readonly string[];
  readonly tools: readonly string[];
}

export interface ExtensionFilter {
  readonly deny: ExtensionResourceFilter;
  /** When present, only these package sources and tool names remain enabled. */
  readonly allow?: ExtensionResourceFilter;
}

export interface ExtensionWithTools {
  readonly tools: ReadonlyMap<string, { readonly definition: { readonly name: string; readonly exposure?: string } }>;
}

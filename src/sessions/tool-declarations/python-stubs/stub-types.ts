export type LiteralValue = string | number | boolean | null;

export type PythonType =
  | { readonly kind: "name"; readonly text: string }
  | { readonly kind: "literal"; readonly values: readonly LiteralValue[] }
  | { readonly kind: "list"; readonly item: PythonType }
  | { readonly kind: "tuple"; readonly items: readonly PythonType[] }
  | { readonly kind: "dict"; readonly value: PythonType }
  | { readonly kind: "union"; readonly items: readonly PythonType[] }
  | PythonObject;

/**
 * An inline JSON Schema object. It prints as a named TypedDict, or as dict[str, Any] when the schema also allows
 * keys it does not name (`extra`): a TypedDict cannot say that.
 */
export interface PythonObject {
  readonly kind: "object";
  readonly name: string;
  readonly fields: readonly PythonField[];
  readonly extra?: PythonType;
}

export interface PythonField {
  readonly key: string;
  readonly optional: boolean;
  readonly type: PythonType;
  /** The schema description, one entry per line. */
  readonly description: readonly string[];
  /** Constraint tags such as `@integer @minimum 1`; empty when there are none. */
  readonly tags: string;
}

/** One rendering of one schema: `root` resolves local $refs, `names` keeps the generated TypedDict names unique. */
export interface StubContext {
  readonly root: unknown;
  readonly resolving: Set<string>;
  readonly names: Set<string>;
  readonly tags: boolean;
  /** PascalCase prefix of every generated TypedDict, e.g. `WebSearchArgs`. */
  readonly stem: string;
  expansions: number;
}

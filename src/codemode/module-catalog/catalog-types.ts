import type { ModuleDependencies } from "../module-payload/module-types.ts";

export interface KernelHelper {
  name: string;
  description: string;
  signature: string;
  /** Typed stub of the function (def line and its docstring's first paragraph), rendered by the kernel from the function itself. */
  stub?: string;
  /** TypedDict stubs the def line refers to, keyed by class name; shared by name across functions. */
  types?: Readonly<Record<string, string>>;
  module?: string;
  source?: string;
  available?: boolean;
  error?: string;
  overridesBuiltin?: boolean;
  dependencies?: ModuleDependencies;
  moduleOnly?: boolean;
  pending?: boolean;
}

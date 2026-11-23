import type { ModuleDependencies } from "../module-payload/module-types.ts";

export interface KernelHelper {
  name: string;
  description: string;
  signature: string;
  module?: string;
  source?: string;
  available?: boolean;
  error?: string;
  overridesBuiltin?: boolean;
  dependencies?: ModuleDependencies;
  moduleOnly?: boolean;
  pending?: boolean;
}

import type { DerivedSessionSchemas } from "../../plugins/sessions/session-types.ts";
import type { DerivationEnvironment } from "./derivation-types.ts";

export interface DerivationContext {
  readonly env: DerivationEnvironment;
  readonly schemas: DerivedSessionSchemas;
  readonly busy: Set<string>;
  readonly closing: Set<string>;
}

import type { createDerivedSessionSchemas } from "../../plugins/sessions/create-derived-session-schemas.ts";
import type { DerivationConfig } from "../../config/derivation/derivation-types.ts";
import type { createSessionDerivation } from "../../sessions/derivation/assemble-derivation.ts";

export interface DerivationState {
  derivationSchemas: ReturnType<typeof createDerivedSessionSchemas>;
  derivationConfig: DerivationConfig;
  derivation: ReturnType<typeof createSessionDerivation>;
}

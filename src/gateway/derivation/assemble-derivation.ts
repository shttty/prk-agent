import { spawnDerived } from "./spawn-derived-session.ts";
import { manageSession } from "./manage-session.ts";
import type { HostContext } from "../host/host-state.ts";
import type { DerivationMethods } from "./derivation-methods.ts";
import { derivationGet } from "./read-derivation-settings.ts";
import { derivationSet } from "./save-derivation-settings.ts";

export function assembleDerivation(ctx: HostContext): DerivationMethods {
  return {
    derivationGet: derivationGet.bind(undefined, ctx),
    derivationSet: derivationSet.bind(undefined, ctx),
    spawnDerived: spawnDerived.bind(undefined, ctx),
    manageSession: manageSession.bind(undefined, ctx),
  };
}

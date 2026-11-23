import { Type } from "typebox";
import { Value } from "typebox/value";
import type { GenerationContext } from "../generation-types.ts";

const policyEvent = Type.Object({
  name: Type.String({ minLength: 1 }),
  diagnostic: Type.Object({
    code: Type.Literal("PROVIDER_POLICY"),
    providerId: Type.String(),
    operation: Type.Union([Type.Literal("register"), Type.Literal("unregister")]),
    path: Type.String(),
    error: Type.String(),
    source: Type.Optional(Type.String()),
  }, { additionalProperties: false }),
}, { additionalProperties: false });

/** Validate a target diagnostic once, then retain it in the existing package metadata. */
export function recordProviderError(ctx: GenerationContext, payload: unknown): void {
  if (!Value.Check(policyEvent, payload)) throw new Error("Invalid remote provider policy diagnostic.");
  const pkg = ctx.registration?.packages.find((entry) => entry.name === payload.name);
  if (!pkg) throw new Error(`Unknown remote provider policy package: ${payload.name}`);
  (pkg.providerErrors ??= []).push(payload.diagnostic);
  ctx.options.onProviderError?.();
}

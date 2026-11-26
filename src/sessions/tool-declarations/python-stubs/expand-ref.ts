import { resolveSchemaRef } from "@earendil-works/pi-codemode/declarations";
import type { StubContext } from "./stub-types.ts";

/** Local $ref expansions per rendered schema, so shared definitions cannot blow up the output (Pi 1.6.0 MAX_REF_EXPANSIONS). */
const MAX_REF_EXPANSIONS = 32;

/** The schema a local $ref names, or undefined for a ref that is being expanded already (recursion), is remote or names nothing, or past the expansion limit. */
export function expandRef(ref: string, ctx: StubContext): unknown {
  if (ctx.resolving.has(ref) || ctx.expansions >= MAX_REF_EXPANSIONS) return undefined;
  const target = resolveSchemaRef(ref, ctx.root);
  if (target !== undefined) ctx.expansions++;
  return target;
}

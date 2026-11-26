import { ANY, NEVER } from "./builtin-types.ts";
import { printType } from "./print-type.ts";
import type { LiteralValue, PythonType } from "./stub-types.ts";

const isName = (type: PythonType, text: string) => type.kind === "name" && type.text === text;

/** The union of the variants: duplicates merge, Any absorbs the rest, Never drops out, literals share one `Literal[...]` and None goes last (`str | None`). */
export function unionType(variants: readonly PythonType[]): PythonType {
  const flat = variants.flatMap((variant) => variant.kind === "union" ? variant.items : [variant]);
  if (flat.some((variant) => isName(variant, "Any"))) return ANY;
  const unique = [...new Map(flat.filter((variant) => !isName(variant, "Never")).map((variant) => [printType(variant), variant])).values()];
  const values: LiteralValue[] = [...new Set(unique.flatMap((variant) => variant.kind === "literal" ? variant.values : []))];
  const firstLiteral = unique.findIndex(({ kind }) => kind === "literal");
  const merged = unique.flatMap((variant, index): PythonType[] => variant.kind !== "literal" ? [variant] : index === firstLiteral ? [{ kind: "literal", values }] : []);
  const items = [...merged.filter((variant) => !isName(variant, "None")), ...merged.filter((variant) => isName(variant, "None"))];
  return items.length === 0 ? NEVER : items.length === 1 ? items[0]! : { kind: "union", items };
}

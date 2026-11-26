const EXPORTED_FUNCTION = /^export\s+(?:default\s+)?(?:async\s+)?function\b|^export\s+(?:const|let)\s+\w+\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|\w+\s*=>)/;

/** Counts `export function`, `export async function` and `export const x = (...) =>` style declarations. */
export function countExportedFunctions(codeLines) {
  return codeLines.filter((line) => EXPORTED_FUNCTION.test(line)).length;
}

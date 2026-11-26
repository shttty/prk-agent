/** Node cannot run JSX: a unit test may only import JSX-free .ts/.js modules. Returns the offending specifiers. */
export function findUnitUiImports(text) {
  return [...text.matchAll(/(?:from\s+|import\s*\(?\s*)["']([^"']+\.(?:jsx|tsx))["']/g)].map((match) => match[1]);
}

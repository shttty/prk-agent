export function matchesPackageFilter(pattern: string, source: string): boolean {
  if (pattern === source) return true;
  const packageName = pattern.startsWith("npm:") ? pattern.slice("npm:".length) : pattern;
  if (!source.startsWith("npm:")) return false;
  const sourceSpec = source.slice("npm:".length);
  return sourceSpec === packageName || sourceSpec.startsWith(`${packageName}@`);
}

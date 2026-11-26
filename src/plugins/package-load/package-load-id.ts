/** Capability key of the package load switch; the source is the `packages[].source` of the Gateway settings. */
export function packageLoadId(source: string): string {
  return `load:package:${source}`;
}

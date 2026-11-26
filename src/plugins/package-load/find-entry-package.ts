import type { LoadablePackage } from "./package-load-types.ts";

/** The settings package a catalog group belongs to: `group:{tools,skills}:package:<name>` or `group:tools:remote:<instance>:<source>`. */
export function entryPackageSource(group: string, packages: readonly LoadablePackage[]): string | undefined {
  const named = /^group:(?:tools|skills):package:(.+)$/u.exec(group)?.[1];
  if (named !== undefined) return packages.find((pkg) => pkg.name === named)?.source;
  const remote = /^group:tools:remote:[^:\s]+:(.+)$/u.exec(group)?.[1];
  return remote === undefined ? undefined : packages.find((pkg) => pkg.source === remote)?.source;
}

import { createHash } from "node:crypto";
import { posix } from "node:path";
import type { BunRegistry } from "../../config/execution-target/validation/bun-package-options.ts";

export type BunPackages = BunRegistry & { readonly cacheRoot: string };

export function bunPackageRoot(target: string, executable: string, { cacheRoot, registry, scopes = {} }: BunPackages) {
  const source = createHash("sha256").update(JSON.stringify([registry, Object.entries(scopes).sort(), executable])).digest("hex");
  return posix.join(cacheRoot, "bun-packages", encodeURIComponent(target).replaceAll(".", "%2E"), source);
}

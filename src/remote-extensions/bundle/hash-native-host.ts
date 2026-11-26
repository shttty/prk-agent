import { createHash } from "node:crypto";
import type { ArtifactPlatform } from "../../artifacts/store/store-types.ts";

/** Cache key of the native tool host bundle: exactly what is copied into it (npm's installed location@version set,
 * order-free), the host sources, and the Node runtime/platform it ships with. The lock file is not an input, so an
 * unrelated dependency upgrade keeps the key and the bundle. */
export function hashNativeHost(packages: ReadonlyArray<{ location: string; version: string }>, hostFiles: readonly Buffer[], platform: ArtifactPlatform): string {
  const key = createHash("sha256").update("native-host-v2\0");
  const sorted = [...packages].sort((left, right) => left.location < right.location ? -1 : left.location > right.location ? 1 : 0);
  for (const { location, version } of sorted) key.update(`${location}\0${version}\0`);
  key.update(`${process.versions.node}\0${platform}\0`);
  for (const file of hostFiles) key.update(file);
  return key.digest("hex");
}

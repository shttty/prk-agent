import { posix } from "node:path";
import { DEFAULT_TARGET_CACHE_ROOT } from "../../config/target-cache/target-cache-options.ts";

export function resolveCacheRoot(home: string, configured = DEFAULT_TARGET_CACHE_ROOT): string {
  return posix.normalize(configured.startsWith("~/") ? posix.join(home, configured.slice(2)) : configured);
}

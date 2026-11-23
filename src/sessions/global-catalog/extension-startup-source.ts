import { isAbsolute } from "node:path";
import type { Extension } from "@earendil-works/pi-coding-agent";

export function extensionStartupSource(info: Extension["sourceInfo"] | undefined): string | undefined {
  if (!info) return;
  return info.origin === "package" ? info.source : isAbsolute(info.path) || info.path.startsWith("builtin:") ? info.path : undefined;
}

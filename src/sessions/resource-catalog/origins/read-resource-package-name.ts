import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ToolInfo } from "@earendil-works/pi-coding-agent";

export function packageName(source: ToolInfo["sourceInfo"]): string {
  let directory = dirname(source.path);
  while (directory !== dirname(directory)) {
    try {
      const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      if (typeof manifest.name === "string") return manifest.name;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    }
    directory = dirname(directory);
  }
  return source.source;
}

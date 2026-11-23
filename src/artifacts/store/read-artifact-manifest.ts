import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "typebox/value";
import type { ArtifactManifest } from "./store-types.ts";
import { manifestSchema } from "./manifest/store-constants.ts";

/** Read freshly so API publication is immediately visible to the Gateway. */
export function readManifest(directory: string): ArtifactManifest {
  let text: string;
  try { text = readFileSync(join(directory, "manifest.json"), "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { tools: {} };
    throw error;
  }
  const manifest: unknown = JSON.parse(text);
  if (!Value.Check(manifestSchema, manifest)) throw new Error("Invalid artifact manifest.");
  const result = manifest as ArtifactManifest;
  for (const tool of Object.values(result.tools)) {
    if (!Object.hasOwn(tool.versions, tool.current)
      || Object.values(tool.versions).some((version) => Object.keys(version.platforms).length === 0)) {
      throw new Error("Invalid artifact manifest.");
    }
  }
  return result;
}

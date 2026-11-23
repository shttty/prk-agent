import { WireError } from "../../gateway/wire/create-error.ts";
import { prkPaths } from "../home/resolve-prk-paths.ts";
import type { PrkConfig } from "./document-types.ts";
import { readPrkConfigDocument } from "./read-prk-config-document.ts";
import { readPrkInstanceDocument } from "./read-prk-instance-document.ts";
import { parsePrkConfig } from "./parse-prk-config.ts";
import { rejectLegacyJsonConfig } from "./storage/reject-legacy-json.ts";

export async function loadPrkConfig(home: string): Promise<PrkConfig> {
  try {
    await rejectLegacyJsonConfig(home);
    const paths = prkPaths(home);
    const document = await readPrkConfigDocument(paths.configPath) ?? {};
    const instances = await readPrkInstanceDocument(paths.instancesPath);
    return parsePrkConfig(document, instances);
  } catch (error) {
    // This boundary runs only project-owned file loading and configuration validators.
    throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid PRK configuration.");
  }
}

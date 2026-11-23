import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPackageDir, VERSION } from "@earendil-works/pi-coding-agent";

export async function installedRelease(): Promise<{ readonly version: string; readonly changelog: string }> {
  let changelog = "Changelog unavailable.";
  try { changelog = await readFile(join(getPackageDir(), "CHANGELOG.md"), "utf8"); }
  catch { /* The installed package may omit release notes. */ }
  return { version: VERSION, changelog };
}

import type { HostedKeybindingsManager } from "../../ui-types.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getPackageDir } from "@earendil-works/pi-coding-agent";

// Approved internal seam, reverified for Pi 1.6.0: create(agentDir) and inspected component fields remain compatible.
// never substitute the pi-tui base class or modify upstream/global bindings.
export async function loadKeybindings(agentDir: string): Promise<HostedKeybindingsManager> {
const sdkDir = getPackageDir();
const { version } = JSON.parse(await readFile(join(sdkDir, "package.json"), "utf8")) as { version: string };
if (version !== "1.6.0") throw new Error(`Hosted extension component adapter requires Pi 1.6.0; found ${version}. Reverify the internal keybindings/component seam before upgrading.`);
// Static package import is blocked by Pi's exports map; the installed SDK
// directory is runtime-selected. This file URL is the one approved internal import.
const { KeybindingsManager }: { KeybindingsManager: { create(agentDir: string): HostedKeybindingsManager } } = await import(pathToFileURL(join(sdkDir, "dist/core/keybindings.js")).href);
const keybindings = KeybindingsManager.create(agentDir);
return keybindings;
}

import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Skill } from "@earendil-works/pi-coding-agent";
import { allSkills } from "../skills/list-skills.ts";
import type { RuntimeContext } from "../../runtime-state.ts";
import { registrationSettingsVersion } from "./format-settings-version.ts";

/** Only public SDK resource entry paths; target files stay on their advertised machine. */
export function registrationFileVersions(ctx: RuntimeContext, skills: readonly Skill[] = allSkills(ctx)): Map<string, string> {
  const paths = new Set([
    ...(ctx.unfilteredLoader?.getExtensions().extensions.map((extension) => extension.resolvedPath) ?? []),
    ...skills.filter((skill) => skill.sourceInfo.source !== "target").map((skill) => skill.filePath),
  ].filter(isAbsolute));
  const versions = new Map([...paths].map((path) => {
    const file = statSync(path, { throwIfNoEntry: false });
    return [path, file ? `${file.mtimeMs}:${file.size}` : "missing"];
  }));
  for (const path of [join(ctx.dependencies.agentDir, "settings.json")]) {
    let source: string | undefined;
    try { source = readFileSync(path, "utf8"); }
    catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
    versions.set(`settings:${path}`, registrationSettingsVersion(source));
  }
  return versions;
}

import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Pi omits root .md files here; publish only these missing paths through resources_discover. */
export function gatewayRootSkillPaths(): string[] {
  const root = resolve(homedir(), ".agents/skills");
  try {
    if (statSync(join(root, "SKILL.md"), { throwIfNoEntry: false })?.isFile()) return [];
    return readdirSync(root).filter((name) => !name.startsWith(".") && name.endsWith(".md") && statSync(join(root, name), { throwIfNoEntry: false })?.isFile()).sort().map((name) => join(root, name));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

import type { SkillLibraryContext } from "../skill-types.ts";
import { lstatSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { SKILL_NAME_PATTERN } from "../skill-constants.ts";

export function path(ctx: SkillLibraryContext, name: string, path: string): string {
  if (!new RegExp(SKILL_NAME_PATTERN, "u").test(name) || name.length > 64) throw new Error("Invalid skill name.");
  if (!path || isAbsolute(path) || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === ".." || /\p{Cc}/u.test(part))) throw new Error("Skill path must stay inside its skill directory.");
  const base = join(ctx.directory, name);
  let current = base;
  for (const part of ["", ...path.split("/")]) {
    current = join(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error("Skill paths cannot traverse symbolic links."); }
    catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
  }
  return join(base, path);
}

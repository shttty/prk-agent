import type { SkillLibraryContext } from "../skill-types.ts";
import { join } from "node:path";
import { list } from "./list.ts";

export function paths(ctx: SkillLibraryContext, context?: { instance: string; projectId?: string }): string[] {
  return list(ctx).filter((entry) => entry.status !== "archived" && (context === undefined || entry.scope === "global"
    || entry.scope === `instance:${context.instance}` || (context.projectId !== undefined && entry.scope === `project:${context.projectId}`)))
    .map((entry) => join(ctx.directory, entry.name, "SKILL.md"));
}

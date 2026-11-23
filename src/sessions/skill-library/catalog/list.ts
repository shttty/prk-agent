import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { SkillLibraryContext, SkillLibraryEntry } from "../skill-types.ts";
import { age } from "../lifecycle/age-records.ts";
import { path as resolveOwnedPath } from "../documents/resolve-owned-path.ts";
import { frontmatter as parseSkillFrontmatter } from "../documents/parse-frontmatter.ts";

export function list(ctx: SkillLibraryContext): SkillLibraryEntry[] {
  age(ctx);
  return ctx.records.map(({ sessions, createdAt: _created, changedAt: _changed, promotionReady: _ready, ...record }) => {
    const content = readFileSync(resolveOwnedPath(ctx, record.name, "SKILL.md"), "utf8");
    const base = join(ctx.directory, record.name);
    const files = readdirSync(base, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => relative(base, join(entry.parentPath, entry.name))).sort();
    return { ...record, ...parseSkillFrontmatter(ctx, record.name, content), distinctSessions: sessions.length, content, files };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

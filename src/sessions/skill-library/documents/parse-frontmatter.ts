import type { SkillLibraryContext } from "../skill-types.ts";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

export function frontmatter(ctx: SkillLibraryContext, name: string, content: string): { description: string; whenToUse: string; evidence: string; body: string } {
  const { frontmatter, body } = parseFrontmatter(content);
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) throw new Error("SKILL.md requires frontmatter with name, description, when-to-use and evidence.");
  if (frontmatter.name !== name || typeof frontmatter.description !== "string" || !frontmatter.description.trim() || frontmatter.description.length > 1024) throw new Error("SKILL.md requires a matching name and a nonempty description of at most 1024 characters.");
  if (typeof frontmatter["when-to-use"] !== "string" || !frontmatter["when-to-use"].trim() || typeof frontmatter.evidence !== "string" || !frontmatter.evidence.trim()) throw new Error("SKILL.md requires nonempty when-to-use and evidence fields. Record concrete task, session, correction, failure or observed-result facts; do not invent evidence.");
  return { description: frontmatter.description, whenToUse: frontmatter["when-to-use"], evidence: frontmatter.evidence, body };
}

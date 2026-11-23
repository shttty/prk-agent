import { SKILL_SECTIONS } from "../skill-constants.ts";

export function sectionBody(section: keyof typeof SKILL_SECTIONS, value: string | string[]): string {
  // The caller supplies text, not Markdown structure. Escape fence/heading syntax.
  if (typeof value === "string") return value.replace(/[\\`#~]/gu, "\\$&");
  return value.map((item, index) => {
    const prefix = section === "pitfalls" ? "- " : `${index + 1}. `;
    return prefix + item.replace(/[\\`#~]/gu, "\\$&").replace(/\n/gu, "\n" + " ".repeat(prefix.length));
  }).join("\n");
}

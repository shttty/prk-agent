import { SKILL_SECTIONS } from "../skill-constants.ts";
import { sectionBody } from "./format-section.ts";

export function replaceSection(body: string, section: keyof typeof SKILL_SECTIONS, value: string | string[]): string {
  const lines = body.split("\n");
  const headings: number[] = [];
  let fence: string | undefined;
  for (const [index, line] of lines.entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = undefined;
      continue;
    }
    if (!fence && /^#{1,2} /u.test(line)) headings.push(index);
  }
  const matching = headings.filter((index) => lines[index] === `## ${SKILL_SECTIONS[section]}`);
  if (matching.length !== 1) throw new Error(`Cannot patch ${section}: expected exactly one "## ${SKILL_SECTIONS[section]}" section; found ${matching.length}. Human-written sections are not inferred.`);
  const start = matching[0]!;
  const end = headings.find((index) => index > start) ?? lines.length;
  return [...lines.slice(0, start + 1), sectionBody(section, value), "", ...lines.slice(end)].join("\n").trim();
}

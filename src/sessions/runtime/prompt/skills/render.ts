import { formatSkillsForPrompt, type Skill } from "@earendil-works/pi-coding-agent";
import type { ToolMode } from "../../../../config/session/session-options.ts";
import type { KernelLanguage } from "../../../../kernel/kernel-types.ts";

export function renderSkills(skills: Skill[], reader?: {
  mode: ToolMode;
  declared: readonly string[];
  language: KernelLanguage;
  skillReadHidden?: boolean;
}): string {
  const formatted = formatSkillsForPrompt(skills, "indirect");
  if (!formatted) return "";
  // Keep Pi's filtered, escaped entries; PRK owns the instructions for reaching them.
  const start = formatted.indexOf("<available_skills>");
  if (start < 0) return "";
  const catalog = formatted.slice(start);
  if (!reader) return catalog;
  const { mode, declared, language } = reader;
  let read: string;
  if (mode === "code" && declared.includes("kernel_code")) {
    read = language === "bun"
      ? "In kernel_code, use display(await gateway.skill_read({path: absolute_skill_path})) so the contents are visible."
      : "In kernel_code, use print(gateway.skill_read(path=absolute_skill_path)) so the contents are visible.";
  } else if (mode === "direct" && declared.includes("skill_read")) {
    read = "Call skill_read directly with the advertised absolute path.";
  } else if (mode === "direct" && declared.includes("tool_search") && declared.includes("tool_call") && reader.skillReadHidden) {
    read = "Use tool_search to find skill_read, then use tool_call with name=skill_read and the advertised absolute path in args.path.";
  } else {
    return catalog;
  }
  return [
    "When a task matches a skill's description, you MUST read its full SKILL.md before proceeding.",
    read,
    "Use absolute paths in tool calls. Resolve supporting files relative to the skill directory.",
    "",
    catalog,
  ].join("\n");
}

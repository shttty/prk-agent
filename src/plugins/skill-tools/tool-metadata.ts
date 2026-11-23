export const SKILL_TOOL_METADATA = {
  skill_manage: {
    name: "skill_manage",
    description: `Minimal: {"action":"create","name":"inspect-failure","scope":"global","description":"Use when a retained cell fails","whenToUse":"A failed cell needs diagnosis","evidence":"Session example-42 observed a missing import","procedure":["Read the actual traceback"],"pitfalls":[],"verification":[]}
Create a staging shared skill from text fields; the tool generates YAML and fixed Markdown sections. Before creating, review the skills already listed in the system prompt; if a similar skill exists, enhance it with patch instead of creating another. description contains index/discovery trigger signals; whenToUse describes applicability; evidence records concrete task/session, correction, failure or observed results. Without evidence do not write a skill. Keep reusable procedures/pitfalls, not temporary progress.
Required scope has no default: judge whether the skill is portable using the current instance and PRK project selection. Use instance:<current instance> for machine-specific paths, services or hosts; project:<current projectId> for a skill valid only in that PRK project; use global only when genuinely reusable everywhere.
Patch replaces one section using section/value: description, whenToUse, evidence take nonblank strings; scope takes the same explicitly chosen scope as create and changes library metadata only; procedure takes 1–32 ordered text steps; pitfalls/verification take 0–32 text items. See field schemas for character limits. Read first; missing/ambiguous human-written sections fail instead of being guessed. whenToUse/evidence patches update both frontmatter and body.
write_file/remove_file handle skill-relative supporting files only, never SKILL.md. delete removes the whole skill. Restore archived skills before editing.`,
  },
  skill_read: {
    name: "skill_read",
    description: "Read an enabled, loaded, non-shadowed skill file on its advertised machine, including SKILL.md and supporting files. Use the absolute location advertised by the skill catalog.",
  },
};

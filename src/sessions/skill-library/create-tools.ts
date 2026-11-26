import { Type } from "typebox";
import { createReadToolDefinition, defineTool, type Skill, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { SkillLibraryContext, SkillTarget } from "./skill-types.ts";
import { SKILL_TOOL_METADATA } from "../../plugins/skill-tools/tool-metadata.ts";
import { manageSchema, manageResultSchema } from "./tools/skill-schema.ts";
import { access } from "./tools/access.ts";
import { readFile } from "./tools/read-file.ts";
import { manageSkill } from "./tools/manage-skill.ts";
import { readSkill } from "./tools/read-skill.ts";

const readSchema = Type.Object({
  path: Type.String(),
  offset: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
});

export function createSkillTools(library: SkillLibraryContext, skills: () => readonly Skill[], target?: SkillTarget): ToolDefinition[] {
  const reader = createReadToolDefinition(library.directory);
  const targetReader = createReadToolDefinition(library.directory, { operations: {
    access,
    readFile: (path) => readFile(target, path),
  } });
  const ctx = { library, skills, target, reader, targetReader };
  return [
    defineTool({ ...SKILL_TOOL_METADATA.skill_manage, label: "Manage shared skill", parameters: manageSchema, outputSchema: manageResultSchema,
      execute: (id, request) => manageSkill(ctx, id, request),
    }),
    // Drop the generic read snippet and guideline: they would describe a `read` tool in the tool catalog.
    defineTool({ ...reader, ...SKILL_TOOL_METADATA.skill_read, promptSnippet: undefined, promptGuidelines: undefined, label: "Read skill", parameters: readSchema,
      execute: (...args) => readSkill(ctx, ...args),
    }),
  ] as ToolDefinition[];
}

import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { Static } from "typebox";
import type { AgentToolResult, AgentToolUpdateCallback, ExtensionToolContext, ReadToolDetails, ReadToolInput, Skill, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { SkillsOptions } from "../../config/skills/skills-options.ts";
import type { ToolLibraryAction } from "../../codemode/tool-library/library-types.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import type { storedSchema, manageSchema } from "./tools/skill-schema.ts";

export type StoredSkill = Static<typeof storedSchema>;
export type SkillLibraryEntry = {
  name: string; scope: string; description: string; whenToUse: string; evidence: string; status: StoredSkill["status"]; manual: boolean;
  distinctSessions: number; lastUsedAt?: string; content: string; body: string; files: string[];
};

export type SkillManageRequest = Static<typeof manageSchema>;
export type SkillManageArgs = Parameters<AgentTool<typeof manageSchema>["execute"]>;

export interface SkillTarget {
  lease(): TargetLease | undefined;
  directories(): readonly { path: string }[];
  inventory(): readonly Skill[];
}

export interface SkillLibraryContext {
  readonly directory: string;
  readonly file: string;
  records: StoredSkill[];
  readonly options: SkillsOptions;
  readonly now: () => number;
}

export interface SkillReader {
  execute(toolCallId: string, input: ReadToolInput, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<ReadToolDetails | undefined> | undefined, context: ExtensionToolContext): Promise<AgentToolResult<ReadToolDetails | undefined>>;
}

export interface SkillToolsContext {
  readonly library: SkillLibraryContext;
  readonly skills: () => readonly Skill[];
  readonly target?: SkillTarget;
  readonly reader: SkillReader;
  readonly targetReader: SkillReader;
}

export interface SkillLibrary {
  readonly directory: string;
  createTools(skills: () => readonly Skill[], target?: SkillTarget): ToolDefinition[];
  list(): SkillLibraryEntry[];
  paths(context?: { instance: string; projectId?: string }): string[];
  recordRead(absolutePath: string, sessionId: string): void;
  change(action: ToolLibraryAction, name: string): SkillLibraryEntry[];
  setScope(name: string, scope: string): SkillLibraryEntry[];
  manage(request: SkillManageRequest): { skill: SkillLibraryEntry } | { deleted: string };
  readPath(path: string): string;
}

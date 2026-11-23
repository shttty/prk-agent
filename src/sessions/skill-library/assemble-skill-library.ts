import { join } from "node:path";
import type { Skill, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { DEFAULT_SKILLS_OPTIONS, type SkillsOptions } from "../../config/skills/skills-options.ts";
import type { ToolLibraryAction } from "../../codemode/tool-library/library-types.ts";
import type { SkillLibraryContext, SkillLibraryEntry, SkillManageRequest, SkillTarget } from "./skill-types.ts";
import { initializeLibrary } from "./lifecycle/initialize-library.ts";
import { list } from "./catalog/list.ts";
import { paths } from "./catalog/list-loadable-paths.ts";
import { recordRead } from "./lifecycle/record-read.ts";
import { change } from "./lifecycle/change-status.ts";
import { setScope } from "./lifecycle/set-scope.ts";
import { manage } from "./documents/apply-skill-change.ts";
import { readPath } from "./documents/resolve-readable-path.ts";
import { createSkillTools } from "./create-tools.ts";

/** Shared native files and PRK-owned lifecycle metadata; discovery remains entirely SDK-owned. */
export class SkillLibrary {
  private readonly ctx: SkillLibraryContext;

  constructor(home: string, options: SkillsOptions = DEFAULT_SKILLS_OPTIONS, now: () => number = Date.now) {
    const directory = join(home, "skills");
    this.ctx = { options, now, directory, file: join(directory, "library.json"), records: [] };
    initializeLibrary(this.ctx);
  }

  get directory(): string { return this.ctx.directory; }
  createTools(skills: () => readonly Skill[], target?: SkillTarget): ToolDefinition[] { return createSkillTools(this.ctx, skills, target); }
  list(): SkillLibraryEntry[] { return list(this.ctx); }
  paths(context?: { instance: string; projectId?: string }): string[] { return paths(this.ctx, context); }
  recordRead(absolutePath: string, sessionId: string): void { recordRead(this.ctx, absolutePath, sessionId); }
  change(action: ToolLibraryAction, name: string): SkillLibraryEntry[] { return change(this.ctx, action, name); }
  setScope(name: string, scope: string): SkillLibraryEntry[] { return setScope(this.ctx, name, scope); }
  manage(request: SkillManageRequest): { skill: SkillLibraryEntry } | { deleted: string } { return manage(this.ctx, request); }
  readPath(path: string): string { return readPath(this.ctx, path); }
}

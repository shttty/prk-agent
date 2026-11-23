import { isAbsolute, resolve } from "node:path";
import type { ExtensionFactory, Skill } from "@earendil-works/pi-coding-agent";
import type { SkillLibrary, SkillTarget } from "../../sessions/skill-library/skill-types.ts";
import { gatewayRootSkillPaths } from "../../sessions/resource-catalog/discover-gateway-root-skills.ts";
import { renderSkillTools } from "./prompt/render.ts";

export function assembleSkillToolsPlugin(library: Pick<SkillLibrary, "directory" | "createTools" | "recordRead"> | undefined, runtime: {
  enabled(): boolean;
  callableTools(): readonly string[];
  skills(): readonly Skill[];
  readonly target?: SkillTarget;
  sharedPaths(): Iterable<string>;
  noSkills(): boolean;
  sessionId(): string;
  nativeToolsEnabled(): boolean;
  autoSkills(): boolean;
  readonly instance: string;
  projectId?(): string | undefined;
}): ExtensionFactory {
  return (pi) => {
    if (library) for (const tool of library.createTools(runtime.skills, runtime.target)) pi.registerTool(tool);
    pi.on("resources_discover", () => ({ skillPaths: [...runtime.sharedPaths(), ...(runtime.noSkills() ? [] : gatewayRootSkillPaths())] }));
    pi.on("tool_result", (event) => {
      if (!library || event.isError || typeof event.input.path !== "string") return;
      if (event.toolName === "skill_read") library.recordRead(resolve(library.directory, event.input.path), runtime.sessionId());
      else if (runtime.nativeToolsEnabled() && event.toolName === "read" && isAbsolute(event.input.path)) library.recordRead(event.input.path, runtime.sessionId());
    });
    pi.on("context_with_system", (event) => {
      const content = runtime.enabled() ? renderSkillTools({ autoSkills: runtime.autoSkills(), instance: runtime.instance, projectId: runtime.projectId }, runtime.callableTools()) : "";
      return { messages: event.messages.map((message) => message.role !== "system" ? message : {
        ...message, sections: { ...message.sections, skill_tools: content ? `<skill_tools>\n${content}\n</skill_tools>` : null },
      }) };
    });
  };
}

import { readAppendSystemPrompt } from "../../../config/session/read-append-system-prompt.ts";
import { renderProject } from "../prompt/project/render.ts";
import type { ConversationContext } from "../runtime-state.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function appendSystemPromptOverride(ctx: RuntimeContext, conversation: ConversationContext, agentDir: string, base: string[]) {
  const project = ctx.dependencies.projectId?.();
  const projectName = ctx.dependencies.projectName?.();
  conversation.loadedProject = project === undefined ? undefined : { id: project, name: projectName };
  conversation.projectSection = project !== undefined && projectName !== undefined ? renderProject(projectName) : undefined;
  const memory = ctx.memoryStore?.render({
    instance: ctx.target.id,
    ...(project === undefined ? {} : { project }),
    ...(projectName === undefined ? {} : { projectName }),
  });
  return [...base, ...readAppendSystemPrompt(ctx.sessionOptions.soulFile, agentDir), ...(memory ? [memory] : [])];
}

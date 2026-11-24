import { getCurrentTools } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { toolEnabled } from "../capabilities/is-tool-enabled.ts";
import { renderNativeTools } from "../prompt/native-tools/render.ts";
import { renderSkills } from "../prompt/skills/render.ts";
import type { ConversationContext, RuntimeContext } from "../runtime-state.ts";
import { localEnabled } from "../configuration/read-native-tools.ts";
import { capabilityEnabled } from "../capabilities/is-capability-enabled.ts";
import { toolDeclarations } from "../tools/project-declarations.ts";

export function bindSessionHooks(ctx: RuntimeContext, conversation: ConversationContext, pi: ExtensionAPI): void {
  pi.on("tool_call", (event) => {
    if (!toolEnabled(ctx, event.toolName) && !(ctx.python.isFileCallback(event.toolName) && !localEnabled(ctx) && capabilityEnabled(ctx, `tool:${event.toolName}`))) {
      return { block: true, reason: `${event.toolName} 在本会话已关闭` };
    }
  });
  // Public per-request projection keeps PRK instructions current even between two calls in one run.
  pi.on("context_with_system", (event) => {
    const nativeTools = renderNativeTools(ctx);
    const session = ctx.callbackSession;
    const skills = session?.resourceLoader.getSkills().skills ?? [];
    const canRead = session?.getCallableToolNames().includes("skill_read") && toolEnabled(ctx, "skill_read");
    const declared = canRead ? getCurrentTools(event.messages).map(({ name }) => name) : [];
    // Pi applies prepareLoadout's hidden declarations after context_with_system.
    const direct = canRead && ctx.toolMode === "direct" ? toolDeclarations(ctx) : undefined;
    const skillPrompt = renderSkills(skills, canRead ? {
      mode: ctx.toolMode,
      declared: direct ? declared.filter((name) => direct.declared.includes(name)) : declared,
      language: ctx.python.getSnapshot().language,
      skillReadHidden: direct?.hidden.some(({ name }) => name === "skill_read"),
    } : undefined);
    const project = conversation.projectSection;
    return { messages: event.messages.map((message) => message.role !== "system" ? message : {
      ...message,
      sections: {
        ...message.sections,
        ...(project === undefined ? {} : { project }),
        native_tools: nativeTools ? `<native_tools>\n${nativeTools}\n</native_tools>` : null,
        skills: skillPrompt ? `<skills>\n${skillPrompt}\n</skills>` : null,
      },
    }) };
  });
}

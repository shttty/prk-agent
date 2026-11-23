import { formatSkillsForPrompt } from "@earendil-works/pi-coding-agent";
import { toolEnabled } from "../capabilities/is-tool-enabled.ts";
import { renderNativeTools } from "../prompt/native-tools/render.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { localEnabled } from "../configuration/read-native-tools.ts";
import { capabilityEnabled } from "../capabilities/is-capability-enabled.ts";
import type { ConversationContext } from "../runtime-state.ts";

export function bindSessionHooks(ctx: RuntimeContext, conversation: ConversationContext, pi: ExtensionAPI) : void {
            pi.on("tool_call", (event) => {
              if (!toolEnabled(ctx, event.toolName) && !(ctx.python.isFileCallback(event.toolName) && !localEnabled(ctx) && capabilityEnabled(ctx, `tool:${event.toolName}`))) {
                return { block: true, reason: `${event.toolName} 在本会话已关闭` };
              }
            });
            // Public per-request projection keeps PRK instructions current even between two calls in one run.
            pi.on("context_with_system", (event) => {
              const nativeTools = renderNativeTools(ctx);
              const skills = formatSkillsForPrompt(ctx.callbackSession?.resourceLoader.getSkills().skills ?? [], "indirect").trim();
              const project = conversation.projectSection;
              return { messages: event.messages.map((message) => message.role !== "system" ? message : {
                ...message,
                sections: { ...message.sections, ...(project === undefined ? {} : { project }), native_tools: nativeTools ? `<native_tools>\n${nativeTools}\n</native_tools>` : null, skills: skills ? `<skills>\n${skills}\n</skills>` : null },
              }) };
            });
          }

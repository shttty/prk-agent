import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { KernelLanguage, KernelLanguageChange, PythonToolClient } from "../../kernel/kernel-types.ts";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { KernelCallbackScope } from "../../kernel/kernel-types.ts";
import { registerCellTools } from "./register-cell-tools.ts";
import { bindCellEvents } from "./bind-cell-events.ts";
import { appendCellOpen } from "../../sessions/history/kernel-cells/append-cell-receipt.ts";
import type { KernelPromptInput } from "./prompt/kernel/prompt-types.ts";
import { renderKernel } from "./prompt/kernel/render.ts";
import { renderGatewayCalls } from "./prompt/gateway-calls/render.ts";
import { registerLanguageTool } from "./register-language-tool.ts";
import { requireCellTitle } from "./require-cell-title.ts";

export function assembleKernelPlugin(tool: PythonToolClient["tool"], runtime?: {
  /** kernel_code is callable; code mode locks it on even when the kernel plugin group is switched off. */
  toolEnabled(): boolean;
  prepareLoadout: NonNullable<PythonToolClient["tool"]["prepareLoadout"]>;
  afterCompaction(): void;
  prompt(): KernelPromptInput;
  client?: PythonToolClient;
  session?(): AgentSession | undefined;
  runCallback?: KernelCallbackScope;
  selectLanguage?(language: KernelLanguage): Promise<KernelLanguageChange>;
  /** Tool titles are on: the cell title becomes the required call title for the next request. */
  titleRequired?(): boolean;
}): ExtensionFactory {
  return (pi) => {
    if (!runtime) { pi.registerTool(tool); return; }
    const { client, session, runCallback } = runtime;
    let stopEvents: (() => void) | undefined;
    const registerCode = () => pi.registerTool({ ...(client?.tool ?? tool), prepareLoadout: runtime.prepareLoadout,
      execute: async (...args) => {
        const owner = session?.();
        if (!client || !owner) return tool.execute(...args);
        stopEvents ??= bindCellEvents(pi, owner, client);
        return client.executeOwned({ runCallback, beforeYield: (cell) => appendCellOpen(owner.sessionManager, cell) }, ...args);
      },
    });
    registerCode();
    let language = client?.getSnapshot().language ?? "python";
    const unsubscribe = client?.subscribe((snapshot) => {
      if (language !== snapshot.language) { language = snapshot.language; registerCode(); }
    });
    if (runtime.selectLanguage) registerLanguageTool(pi, runtime.selectLanguage);
    if (client && session) registerCellTools(pi, client, session);
    pi.on("session_shutdown", () => { unsubscribe?.(); stopEvents?.(); });
    pi.on("session_compact", () => runtime.afterCompaction());
    pi.on("context_with_system", (event) => {
      const enabled = runtime.toolEnabled();
      const kernel = enabled ? renderKernel(runtime.prompt()) : "";
      const gatewayCalls = enabled ? renderGatewayCalls(language) : "";
      const titled = runtime.titleRequired?.() === true;
      return { messages: event.messages.map((message) => message.role !== "system" ? message : {
        ...message,
        ...(titled && message.toolsAdded ? { toolsAdded: message.toolsAdded.map((added) => added.name === tool.name ? requireCellTitle(added) : added) } : {}),
        sections: { ...message.sections,
          kernel: kernel ? `<kernel>\n${kernel}\n</kernel>` : null,
          gateway_calls: gatewayCalls ? `<gateway_calls>\n${gatewayCalls}\n</gateway_calls>` : null,
        },
      }) };
    });
  };
}

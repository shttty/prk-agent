import type { ExtensionFactory, InputSource } from "@earendil-works/pi-coding-agent";
import type { MemoryResult, MemoryStore } from "../../sessions/memory/memory-types.ts";
import type { MemoryScope } from "../../sessions/memory-review/review-types.ts";
import { createMemoryTool } from "./create-tool.ts";
import { renderMemory } from "./prompt/render.ts";

export function assembleMemoryPlugin(store: MemoryStore | undefined, scope: MemoryScope, runtime: {
  enabled(): boolean;
  callableTools(): readonly string[];
  input?(source: InputSource): void;
  saved?(result: MemoryResult): void | Promise<void>;
}): ExtensionFactory {
  return (pi) => {
    if (store) pi.registerTool(createMemoryTool(store, scope, runtime.saved));
    pi.on("input", (event) => { runtime.input?.(event.source); });
    pi.on("context_with_system", (event) => {
      let layers;
      try { layers = store?.settings().layers; } catch { layers = undefined; }
      const content = runtime.enabled() ? renderMemory(runtime.callableTools(), layers) : "";
      return { messages: event.messages.map((message) => message.role !== "system" ? message : {
        ...message, sections: { ...message.sections, memory: content ? `<memory>\n${content}\n</memory>` : null },
      }) };
    });
  };
}

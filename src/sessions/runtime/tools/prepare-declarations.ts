import type { ToolLoadout } from "@earendil-works/pi-coding-agent";
import type { RuntimeContext } from "../runtime-state.ts";
import { toolDeclarations } from "./project-declarations.ts";

export function prepareDeclarations(ctx: RuntimeContext, loadout: ToolLoadout) {
  const projection = toolDeclarations(ctx);
  const declared = new Set(projection.declared);
  const hidden = new Set<string>();
  for (const tool of loadout.declared) {
    if (!declared.has(tool.name)) hidden.add(tool.name);
  }
  return { hiddenDeclarations: [...hidden] };
}

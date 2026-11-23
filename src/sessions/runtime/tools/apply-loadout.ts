import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { RuntimeContext } from "../runtime-state.ts";
import { toolDeclarations } from "./project-declarations.ts";
import { META_TOOL_NAMES } from "../../tool-declarations/meta-tool-names.ts";
import { orderTools } from "../../../plugins/tool-search/order-tools.ts";

export function applyToolLoadout(ctx: RuntimeContext, session: AgentSession, refreshLibrary = true): void {
    if (refreshLibrary) ctx.disposeLibrary?.refresh();
    const showDiscovery = ctx.toolMode === "direct" && toolDeclarations(ctx, session).hidden.length > 0;
    session.setActiveToolsByName(orderTools(session.getAllTools()).filter((tool) => tool.exposure !== "hidden"
      && (!Object.hasOwn(META_TOOL_NAMES, tool.name) || showDiscovery)).map((tool) => tool.name));
  }

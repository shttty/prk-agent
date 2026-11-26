import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { projectDeclarations } from "../../tool-declarations/project-declarations.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { declarationTools } from "./declaration-tools.ts";

export function toolDeclarations(ctx: RuntimeContext, session: AgentSession | undefined = ctx.callbackSession) {
  return projectDeclarations({ mode: ctx.toolMode, tools: declarationTools(ctx, session), inlineBudget: ctx.codemodeOptions.inlineBudget });
}

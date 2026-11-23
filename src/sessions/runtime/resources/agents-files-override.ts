import { gatewayContextFile } from "../../target-resources/read-gateway-context.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function agentsFilesOverride(ctx: RuntimeContext, agentDir: string) { return ({ agentsFiles: ctx.sessionOptions.noContextFiles ? [] : [...gatewayContextFile(agentDir), ...ctx.targetResources!.agentsFiles] }); }

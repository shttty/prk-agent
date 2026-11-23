import { toolEnabled } from "../capabilities/is-tool-enabled.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { localEnabled } from "../configuration/read-native-tools.ts";

export function allowGatewayTool(ctx: RuntimeContext, name: string) { return toolEnabled(ctx, name) && (!ctx.nativeNames.has(name) || localEnabled(ctx)); }

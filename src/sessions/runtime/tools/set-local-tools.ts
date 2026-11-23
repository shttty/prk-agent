import type { RuntimeContext } from "../runtime-state.ts";

export function setLocalTools(ctx: RuntimeContext, value: boolean): void {
      ctx.localOverride = value;
      ctx.sessionManager.appendCustomEntry("gateway-native-session-state", { version: 1, localTools: value });
    }

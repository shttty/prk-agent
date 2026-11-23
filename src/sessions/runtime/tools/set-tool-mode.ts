import type { ToolMode } from "../../../config/session/session-options.ts";
import { applyToolLoadout } from "./apply-loadout.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function setToolMode(ctx: RuntimeContext, mode: ToolMode): void {
      ctx.toolMode = mode;
      applyToolLoadout(ctx, ctx.active.session);
      ctx.sessionManager.appendCustomEntry("gateway-native-session-state", { version: 1, toolMode: ctx.toolMode });
    }

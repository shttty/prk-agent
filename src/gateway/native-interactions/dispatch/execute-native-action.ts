import type { HostContext } from "../../host/host-state.ts";
import type { NativeActionRequest } from "../../wire/wire-types.ts";
import type { NativeActionResult } from "../../wire/wire-types.ts";
import { isReadOnlyAction } from "../../../sessions/native-interaction/catalog/is-read-only-action.ts";
import { wakesSleepingSession } from "../../../sessions/native-interaction/catalog/wakes-sleeping-session.ts";
import { acknowledgeModelFallback } from "./acknowledge-model-fallback.ts";

export async function nativeAction(ctx: HostContext, sessionId: string, request: NativeActionRequest): Promise<NativeActionResult> {
   if (request.action === "acknowledge-model-fallback") return acknowledgeModelFallback(ctx, sessionId, request);
   if (request.action === "name" || request.action === "extension-ui"
     || (request.action === "capabilities" && Object.keys(request.args ?? {}).length === 0)
     || isReadOnlyAction(request.action)) {
     return ctx.native.nativeInteractions.action(ctx.methods.nativeTarget(sessionId), request);
   }
   if (request.action === "compact") {
     const current = ctx.methods.nativeTarget(sessionId);
     if (!current.readOnly && current.state !== "sleeping") await ctx.methods.ensureRuntime(sessionId);
   }
   // Reuse lifecycle admission so no history write overlaps runtime construction or disposal.
   const settings = ["model", "thinking", "tool-mode", "kernel-language", "delegation", "local-tools", "capabilities", "scoped-models"].includes(request.action);
   const result = settings
     ? await ctx.methods.changeSessionRuntime(sessionId, () => ctx.native.nativeInteractions.action(ctx.methods.nativeTarget(sessionId), request))
     : await ctx.methods.admitInput(sessionId, () => ctx.native.nativeInteractions.action(ctx.methods.nativeTarget(sessionId), request), wakesSleepingSession(request.action));
   // Runtime setters publish their own changes; native thinking/scope and tree need a pushed snapshot.
   if (result.status === "completed" && ["tree", "thinking", "scoped-models", "kernel-language"].includes(request.action)) ctx.sessionHosts.hostBindings.get(sessionId)?.refresh(true);
   return result;
    }

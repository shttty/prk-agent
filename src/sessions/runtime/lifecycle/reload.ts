import { existsSync } from "node:fs";
import { createConversation } from "./start-conversation.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export async function reload(ctx: RuntimeContext): Promise<void> {
      const requireIdle = () => {
        if (!ctx.active.host.isIdle || !ctx.active.session.isIdle || ctx.active.session.isCompacting || ctx.active.session.pendingMessageCount > 0
          || ctx.python.hasInFlightCell()) throw new Error("Session must be idle to reload.");
      };
      requireIdle();
      await ctx.dependencies.ensureEnvironment?.(ctx.target.id);
      requireIdle();
      await ctx.python.prepareHandoff();
      await ctx.active.host.close();
      const file = ctx.sessionManager.getSessionFile();
      if (file && existsSync(file)) ctx.sessionManager.setSessionFile(file);
      ctx.callbackSession = undefined;
      ctx.memoryReview = undefined;
      try {
        ctx.active = await createConversation(ctx);
        ctx.python.resumeAfterHandoff();
        await ctx.python.refreshCapabilities();
      } catch (error) {
        await ctx.active.host.close();
        await ctx.skillLease?.release();
        await ctx.remoteLoad?.close();
        throw error;
      }
    }

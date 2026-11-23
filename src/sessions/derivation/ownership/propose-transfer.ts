import { requireInfo } from "../metadata/require-info.ts";
import { save } from "../metadata/save-state.ts";
import { change } from "../run-change.ts";
import { validateOwner } from "./validate-owner.ts";
import type { DerivationContext } from "../derivation-state.ts";

export async function transfer(ctx: DerivationContext, actor: string, child: string, owner: string) {
    actor = ctx.env.get(actor).manager.getSessionId();
    child = ctx.env.get(child).sessionId;
    owner = ctx.env.get(owner).manager.getSessionId();
    const childId = ctx.env.get(child).manager.getSessionId();
    return change(ctx, child, async () => {
      const state = requireInfo(ctx, child);
      if (!ctx.env.canControl(actor, child)) throw new Error("Cannot transfer this child: control requires a parent or ancestor, root, or this project's supervisor.");
      validateOwner(ctx, child, owner);
      if (owner === state.owner) throw new Error("The selected session is already this child's parent.");
      save(ctx, child, { ...state, pendingOwner: owner });
      await ctx.env.deliver(actor, owner, `[会话转交请求 / child=${childId} / from=${actor}]\n任务：${state.task}\n调用 session_manage({action:"accept",child:${JSON.stringify(childId)}}) 接受；接受前父会话仍为 ${state.owner}。`);
      return { pendingOwner: owner };
    });
  }

import type { SpawnSessionRequest } from "../../../plugins/sessions/session-types.ts";
import { info } from "../metadata/read-info.ts";
import { change } from "../run-change.ts";
import type { DerivationContext } from "../derivation-state.ts";
import { validateOutputSchema } from "../results/validate-output-schema.ts";

export async function spawn(ctx: DerivationContext, actor: string, request: SpawnSessionRequest) {
    actor = ctx.env.get(actor).sessionId;
    if (ctx.closing.has(actor) || ctx.busy.has(actor)) throw new Error("Session lifecycle is changing; no child was created.");
    const value = info(ctx, actor);
    if (value && value.lifecycle !== "user" && value.phase !== "working") {
      throw new Error("This task has already submitted its result; no additional child can be created.");
    }
    if (!request.context.trim()) throw new Error("A non-empty shared context is required.");
    for (const task of request.tasks) {
      if (typeof task.label !== "string" || !task.label.trim()) throw new Error("A non-empty label is required for every child task.");
      if (!task.task.trim()) throw new Error("A non-empty task is required.");
      if (task.outputSchema !== undefined) validateOutputSchema(task.outputSchema);
    }
    return change(ctx, actor, async () => {
      const admissions = await Promise.allSettled(request.tasks.map((task) => ctx.env.spawn(actor, task, request.context)));
      const children = admissions.flatMap((entry, index) => entry.status === "fulfilled" ? [{ index, ...entry.value }] : []);
      const errors = admissions.flatMap((entry, index) => entry.status === "rejected" ? [{ index, error: String(entry.reason) }] : []);
      return { children, errors };
    });
  }

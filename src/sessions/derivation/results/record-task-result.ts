import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import * as Schema from "typebox/schema";
import type { DerivedSessionInfo } from "../../../plugins/sessions/session-types.ts";
import { requireInfo } from "../metadata/require-info.ts";
import { save } from "../metadata/save-state.ts";
import { assertSettled } from "../ownership/assert-children-settled.ts";
import { change } from "../run-change.ts";
import { deliverResult } from "./deliver-result.ts";
import type { DerivationContext } from "../derivation-state.ts";

export async function submit(ctx: DerivationContext, actor: string, summary: string, artifacts: string[], output?: unknown) {
    actor = ctx.env.get(actor).sessionId;
    return change(ctx, actor, async () => {
      const state = requireInfo(ctx, actor);
      if (!summary.trim()) throw new Error("A non-empty task result is required.");
      if (state.outputSchema !== undefined) {
        if (output === undefined) throw new Error("This task requires session_result output matching its outputSchema.");
        const [valid, errors] = Schema.Errors(state.outputSchema, output);
        if (!valid) throw new Error(`Result output does not match outputSchema: ${JSON.stringify(errors)}`);
      }
      assertSettled(ctx, actor);
      if (state.result) {
        const submittedArtifacts = state.result.patch ? state.result.artifacts.filter((path) => path !== state.result!.patch!.path) : state.result.artifacts;
        if (state.result.summary !== summary || JSON.stringify(submittedArtifacts) !== JSON.stringify(artifacts.filter((path) => path !== state.result!.patch?.path)) || !isDeepStrictEqual(state.result.output, output)) {
          throw new Error("This task already submitted a different result; the existing result was not overwritten.");
        }
        await deliverResult(ctx, actor, state);
        return { resultId: state.result.id, phase: requireInfo(ctx, actor).phase, ...(state.result.patch ? { patch: state.result.patch } : {}) };
      }
      const patch = state.isolated ? await ctx.env.prepareResult(actor, state) : undefined;
      if (patch && !artifacts.includes(patch.path)) artifacts = [...artifacts, patch.path];
      const next: DerivedSessionInfo = { ...state, phase: "submitted", result: { id: randomUUID(), summary, artifacts, finishedAt: Date.now(),
        ...(output === undefined ? {} : { output }), ...(state.startedAt === undefined ? {} : { startedAt: state.startedAt }),
        ...(patch ? { patch } : {}),
      } };
      save(ctx, actor, next);
      await deliverResult(ctx, actor, next);
      ctx.env.log(`Derived session ${actor} submitted task ${state.taskId}; delivery is recorded by the parent's receipt.`);
      return { resultId: next.result!.id, phase: requireInfo(ctx, actor).phase, ...(patch ? { patch } : {}) };
    });
  }

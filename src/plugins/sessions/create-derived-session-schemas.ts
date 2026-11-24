import { Type } from "typebox";
import { DEFAULT_LIMITS_OPTIONS } from "../../config/limits/limits-options.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import { thinking } from "./derivation-protocol.ts";
import { DEFAULT_DERIVATION_ROLE } from "../../config/derivation/derivation-types.ts";

export function createDerivedSessionSchemas(limits: LimitsOptions = DEFAULT_LIMITS_OPTIONS) {
  const identity = Type.String({ minLength: 1, maxLength: limits.identityChars });
  const outputSchema = Type.Union([Type.Boolean(), Type.Record(Type.String(), Type.Unknown())]);
  const resultSchema = Type.Object({
    id: identity,
    summary: Type.String({ minLength: 1, maxLength: limits.derivedSummaryChars }),
    artifacts: Type.Array(Type.String({ minLength: 1, maxLength: limits.cwdChars }), { maxItems: limits.derivedArtifactsMax + 1 }),
    output: Type.Optional(Type.Unknown()),
    startedAt: Type.Optional(Type.Number()),
    finishedAt: Type.Optional(Type.Number()),
    patch: Type.Optional(Type.Object({ path: Type.String({ minLength: 1, maxLength: limits.cwdChars }), bytes: Type.Integer({ minimum: 1 }), stats: Type.String() }, { additionalProperties: false })),
  }, { additionalProperties: false });
  const infoSchema = Type.Object({
    createdBy: identity,
    owner: Type.Union([identity, Type.Null()]),
    taskId: identity,
    task: Type.String({ minLength: 1, maxLength: limits.derivedTaskChars }),
    context: Type.Optional(Type.String({ maxLength: limits.derivedTaskChars })),
    outputSchema: Type.Optional(outputSchema),
    startedAt: Type.Optional(Type.Number()),
    lifecycle: Type.Union([Type.Literal("temporary"), Type.Literal("persistent"), Type.Literal("user")]),
    phase: Type.Union([Type.Literal("working"), Type.Literal("submitted"), Type.Literal("delivered")]),
    role: Type.Optional(identity),
    model: Type.String({ minLength: 1 }),
    thinkingLevel: thinking,
    instructions: Type.Optional(Type.String()),
    isolated: Type.Optional(Type.Boolean()),
    repoRoot: Type.Optional(Type.String({ minLength: 1 })),
    worktreeRoot: Type.Optional(Type.String({ minLength: 1 })),
    baseCommit: Type.Optional(Type.String({ minLength: 1 })),
    parentState: Type.Optional(Type.String({ minLength: 1 })),
    pendingOwner: Type.Optional(identity),
    result: Type.Optional(resultSchema),
    /** Native-session subject; authority readers require it to match the session binding. */
    sessionId: Type.Optional(identity),
  }, { additionalProperties: false });
  const taskSchema = Type.Object({
    task: Type.String({ minLength: 1, maxLength: limits.derivedTaskChars }),
    label: Type.String({ minLength: 1, maxLength: limits.labelChars, pattern: "\\S" }),
    lifecycle: Type.Optional(Type.Union([Type.Literal("temporary"), Type.Literal("persistent")], { description: "temporary archives on result; persistent stays" })),
    role: Type.Optional(Type.String({ ...identity, description: `Role id from space_status (default ${DEFAULT_DERIVATION_ROLE})` })),
    model: Type.Optional(Type.String({ minLength: 1 })),
    thinkingLevel: Type.Optional(Type.Union(thinking.anyOf)),
    target: Type.Optional(Type.String({ ...identity })),
    cwd: Type.Optional(Type.String({ minLength: 1, maxLength: limits.cwdChars, description: "Absolute path" })),
    isolated: Type.Optional(Type.Boolean({ description: "Git worktree returning patch" })),
    outputSchema: Type.Optional(outputSchema),
  }, { additionalProperties: false });
  const spawnSchema = Type.Object({
    context: Type.String({ minLength: 1, maxLength: limits.derivedTaskChars, description: "Shared goal, paths, constraints, deliverable (no parent history)" }),
    tasks: Type.Array(taskSchema, { minItems: 1 }),
  }, { additionalProperties: false });
  const spawnResultSchema = Type.Object({
    children: Type.Array(Type.Object({ index: Type.Integer({ minimum: 0 }), sessionId: identity, sessionName: Type.String(), taskId: identity }, { additionalProperties: false })),
    errors: Type.Array(Type.Object({ index: Type.Integer({ minimum: 0 }), error: Type.String() }, { additionalProperties: false })),
  }, { additionalProperties: false });
  const receiptSchema = Type.Object({ child: identity, taskId: identity, result: resultSchema, sessionId: identity });
  return Object.freeze({ limits, identity, resultSchema, infoSchema, spawnSchema, spawnResultSchema, receiptSchema });
}

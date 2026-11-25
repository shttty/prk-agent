import { Type, type Static } from "typebox";
import { CELL_MODES } from "../kernel-options.ts";

const generation = Type.String({ minLength: 1 });
const cellId = Type.String({ minLength: 1 });
const identity = { generation, cellId: Type.Union([cellId, Type.Null()]) };
const id = Type.Integer({ minimum: 1 });
const diagnosticStream = Type.Union([Type.Literal("stdout"), Type.Literal("stderr")]);
// A three-part runtime version, including Python pre-releases and local builds (which may end in '+').
const version = Type.String({ pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:(?:a|b|rc)[0-9]+)?(?:[+-][A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*|\\+)?$" });
const time = Type.Number({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
const label = Type.String({ minLength: 1, maxLength: 256 });
// An internal RegExp without the Unicode flag counts UTF-16 units, unlike maxLength.
const rejectionReason = Type.String({ pattern: /^.{0,2048}$/s });
const stopEvidenceFields = {
  step: label, observedAt: time, status: label, evidence: label,
  action: Type.Optional(label), errno: Type.Optional(id), remainingMs: Type.Optional(time),
};
const stopEvidence = Type.Union([
  Type.Object(stopEvidenceFields, { additionalProperties: false }),
  Type.Object({ ...stopEvidenceFields, step: Type.Literal("task"), status: Type.Literal("queued"),
    targetCellId: cellId, blockingCellId: cellId,
  }, { additionalProperties: false }),
]);
const cellState = {
  state: Type.Union([Type.Literal("running"), Type.Literal("stopping")]),
  blockedAt: Type.Optional(Type.Array(stopEvidence, { maxItems: 16 })),
  observedAt: Type.Optional(time),
};
export const runnerEvent = Type.Union([
  Type.Object({ generation, cellId: Type.Null(), kind: Type.Literal("ready"), pid: id, pgid: id, forkserverPid: Type.Optional(id), scoped: Type.Boolean(),
    language: Type.Union([Type.Literal("python"), Type.Literal("bun")]), version,
  }, { additionalProperties: false }),
  Type.Object({ generation, kind: Type.Literal("diagnostic"), stream: diagnosticStream, text: Type.String() }, { additionalProperties: false }),
  Type.Object({ generation, cellId, kind: Type.Literal("cell_state"), ...cellState }, { additionalProperties: false }),
  Type.Object({ generation, cellId, kind: Type.Literal("cell_admitted"), re: id,
    mode: Type.Optional(Type.Union(CELL_MODES.map((mode) => Type.Literal(mode)))),
  }, { additionalProperties: false }),
  Type.Object({ ...identity, kind: Type.Literal("ack"), re: id }, { additionalProperties: false }),
  Type.Object({ ...identity, kind: Type.Literal("rejected"), re: id, code: Type.String(), reason: Type.Optional(rejectionReason) }, { additionalProperties: false }),
  Type.Object({ ...identity, kind: Type.Literal("cell_end"), re: id, outcome: Type.Union([Type.Literal("ok"), Type.Literal("error"), Type.Literal("aborted")]) }, { additionalProperties: false }),
  Type.Object({ ...identity, kind: Type.Literal("stream"), stream: Type.Union([Type.Literal("stdout"), Type.Literal("stderr"), Type.Literal("result")]), text: Type.String() }, { additionalProperties: false }),
  Type.Object({ ...identity, kind: Type.Literal("display"), data: Type.Record(Type.String(), Type.Unknown()), metadata: Type.Record(Type.String(), Type.Unknown()) }, { additionalProperties: false }),
  Type.Object({ ...identity, kind: Type.Literal("image"), imageId: id, mimeType: Type.String(), data: Type.String(), final: Type.Boolean() }, { additionalProperties: false }),
  Type.Object({ ...identity, kind: Type.Literal("image_omitted") }, { additionalProperties: false }),
  Type.Object({ ...identity, kind: Type.Literal("error"), name: Type.String(), message: Type.String(), traceback: Type.Array(Type.String()) }, { additionalProperties: false }),
  Type.Object({ ...identity, kind: Type.Literal("fatal"), error: Type.String() }, { additionalProperties: false }),
  Type.Object({ ...identity, kind: Type.Literal("callback_chunk"), requestId: id, channel: Type.String(), data: Type.String(), final: Type.Boolean() }, { additionalProperties: false }),
]);

export type RunnerEvent = Static<typeof runnerEvent>;
export type RunnerCellState = Pick<Extract<RunnerEvent, { kind: "cell_state" }>, keyof typeof cellState>;

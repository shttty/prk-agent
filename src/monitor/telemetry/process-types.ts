import { Type, type Static } from "typebox";

const pid = Type.Integer({ minimum: 1, maximum: 2_147_483_647 });
const number = Type.Integer({ minimum: -1, maximum: 2_147_483_647 });
const row = Type.Object({
  pid, parentPid: number, group: number, foregroundGroup: number,
  command: Type.String({ maxLength: 2049 }), cpuPercent: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
  rssBytes: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
}, { additionalProperties: false });

export const processSample = Type.Object({
  t: Type.Literal("processes"), sessionId: Type.String({ minLength: 1, maxLength: 128 }),
  rows: Type.Array(row, { maxItems: 128 }), truncated: Type.Boolean(),
}, { additionalProperties: false });
export type RawProcess = Static<typeof row>;
export type ProcessSample = Static<typeof processSample>;
export type ProcessRoot = { readonly kind: "kernel" | "terminal"; readonly pid: number; readonly running: boolean; readonly infrastructurePid?: number };
export type MonitoredProcess = Pick<RawProcess, "pid" | "command" | "cpuPercent" | "rssBytes"> & {
  readonly depth: number;
  readonly kind: ProcessRoot["kind"];
  readonly ownership: "root" | "infrastructure" | "managed" | "unknown" | "detached";
};

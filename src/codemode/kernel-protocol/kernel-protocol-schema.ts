import { Type } from "typebox";

/** Owning-cell permission lookup for resident kernel functions; never executes another cell. */
export const KERNEL_CAPABILITY_MARKER = "PRK_KERNEL_CAPABILITY:";
/** The one Gateway callback that waits for the user rather than for work (`ask`): a cell's execution deadline does not run while it waits. */
export const USER_WAIT_CALLBACK = "ask";
export const CODE_MIMES = Object.freeze({
  trace: "application/x-prk-trace+json",
  phase: "application/x-prk-phase+json",
  progress: "application/x-prk-progress+json",
  memory: "application/x-prk-memory+json",
  namespace: "application/x-prk-namespace+json",
});
export const operationTrace = Type.Object({
  event: Type.String(), operation: Type.Optional(Type.String()), args: Type.Array(Type.String()),
  phase: Type.Optional(Type.String()), time: Type.Optional(Type.String()),
});
export const cellPhase = Type.Object({ title: Type.String(), time: Type.Optional(Type.String()) });
export const kernelMemory = Type.Object({
  current: Type.Number(), workingSet: Type.Number(), baseline: Type.Number(), extra: Type.Number(), scope: Type.String(),
  memoryMax: Type.String(), memorySwapMax: Type.String(), oomKill: Type.Number(),
});
export const kernelVariable = Type.Object({
  name: Type.String(), type: Type.String(),
  signature: Type.Optional(Type.String()), docstring: Type.Optional(Type.String()),
  origin: Type.Optional(Type.Object({ title: Type.String(), phase: Type.Optional(Type.String()), time: Type.String() })),
});
export const namespaceSummary = Type.Object({
  variables: Type.Array(kernelVariable), added: Type.Array(kernelVariable), modified: Type.Array(kernelVariable),
  deleted: Type.Array(Type.String()), truncated: Type.Boolean(),
});

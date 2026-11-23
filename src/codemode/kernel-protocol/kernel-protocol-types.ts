import type { Static } from "typebox";
import type { operationTrace, cellPhase, kernelMemory, namespaceSummary } from "./kernel-protocol-schema.ts";

type OperationTrace = Static<typeof operationTrace>;
type CellPhase = Static<typeof cellPhase>;
export type KernelMemory = Static<typeof kernelMemory>;
export type NamespaceSummary = Static<typeof namespaceSummary>;
export interface KernelCodeDetails {
  traces: OperationTrace[];
  phases: CellPhase[];
  namespace?: NamespaceSummary;
  callbacks: { name: string; status: "ok" | "error" | "discarded" }[];
}
export type KernelTelemetry =
  | { kind: "trace"; value: OperationTrace }
  | { kind: "phase"; value: CellPhase }
  | { kind: "memory"; value: KernelMemory; cellEnd: boolean }
  | { kind: "namespace"; value: NamespaceSummary };

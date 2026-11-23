import { Value } from "typebox/value";
import { CODE_MIMES, operationTrace, cellPhase, kernelMemory, namespaceSummary } from "./kernel-protocol-schema.ts";
import type { KernelTelemetry } from "./kernel-protocol-types.ts";

/** Private MIME messages are transport metadata, never ordinary display output. */
export function kernelTelemetry(data: Record<string, unknown>, metadata: Record<string, unknown> = {}): KernelTelemetry[] {
  const events: KernelTelemetry[] = [];
  const trace = data[CODE_MIMES.trace];
  const phase = data[CODE_MIMES.phase];
  const memory = data[CODE_MIMES.memory];
  const namespace = data[CODE_MIMES.namespace];
  if (Value.Check(operationTrace, trace)) events.push({ kind: "trace", value: trace });
  if (Value.Check(cellPhase, phase)) events.push({ kind: "phase", value: phase });
  if (Value.Check(kernelMemory, memory)) events.push({ kind: "memory", value: memory, cellEnd: metadata.prk_memory_cell_end === true });
  if (Value.Check(namespaceSummary, namespace)) events.push({ kind: "namespace", value: namespace });
  return events;
}

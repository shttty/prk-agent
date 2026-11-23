import type { KernelHelper } from "./catalog-types.ts";

export function parseKernelToolCatalog(value: unknown): KernelHelper[] {
  if (!Array.isArray(value) || !value.every((entry) => entry && typeof entry === "object"
    && typeof entry.name === "string" && typeof entry.signature === "string" && typeof entry.description === "string"
    && typeof entry.available === "boolean"
    && (entry.error === undefined || typeof entry.error === "string")
    && (entry.module === undefined || typeof entry.module === "string")
    && (entry.source === undefined || typeof entry.source === "string")
    && (entry.overridesBuiltin === undefined || typeof entry.overridesBuiltin === "boolean")
    && (entry.moduleOnly === undefined || typeof entry.moduleOnly === "boolean")
    && (entry.pending === undefined || typeof entry.pending === "boolean"))) {
    throw new Error("Invalid kernel tool catalog report.");
  }
  return value as KernelHelper[];
}

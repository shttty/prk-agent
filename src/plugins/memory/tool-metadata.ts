import type { LayerSpec } from "../../sessions/memory/layers/layer-types.ts";

export const MEMORY_TOOL_NAME = "memory";

/** Tool description for the configured layers; `undefined` layers means the configuration could not be read. */
export function describeMemoryTool(layers: readonly LayerSpec[] | undefined): string {
  if (!layers) return "Save durable cross-task facts for future sessions. Memory is unavailable: localmemory.toml is invalid.";
  const explicit = layers.filter((layer) => layer.explicitOnly).map((layer) => layer.name);
  const targets = layers.map((layer) => `${layer.name}${layer.soft ? "(soft)" : ""}`).join(", ");
  return [
    "Save cross-task facts for future sessions (snapshot frozen; task procedures go to skills).",
    ...(explicit.length ? [`Write ${explicit.join("/")} only on explicit user instruction to set/change a rule.`] : []),
    "Never store secret values—keep value-free semantic facts.",
    "old_text matches one entry; if full, prune+add in one batch.",
    `Targets: ${targets}.`,
  ].join(" ");
}

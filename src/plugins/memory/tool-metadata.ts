import type { LayerSpec } from "../../sessions/memory/layers/layer-types.ts";

export const MEMORY_TOOL_NAME = "memory";

/** Tool description for the configured layers; `undefined` layers means the configuration could not be read. */
export function describeMemoryTool(layers: readonly LayerSpec[] | undefined): string {
  if (!layers) return "Save compact durable knowledge for future sessions. Memory is unavailable: its configuration (~/memories/localmemory.toml) is invalid; calls fail with the reason.";
  const explicit = layers.filter((layer) => layer.explicitOnly).map((layer) => layer.name);
  const soft = layers.filter((layer) => layer.soft).map((layer) => layer.name);
  return [
    "Save compact durable knowledge for future sessions; current session memory stays frozen until startup or reload.",
    "HOW: use {target,action,content?,old_text?}, or {operations:[...]} for all related changes in one atomic batch. replace overwrites the complete entry; old_text must uniquely match one entry. Final capacities apply after the whole batch. All targets save immediately. Success reports usage; do not repeat a saved change.",
    `WHEN: only knowledge that applies regardless of task.${explicit.length ? ` If the entry says how work should be done (a rule, boundary, permission or working preference), it goes to ${explicit.join("/")}, written only on an explicit user instruction to set or change a rule.` : ""} Procedures, pitfalls, and preferences or corrections for a class of task belong in its skill, not memory.`,
    `IF FULL: use the returned current entries to shorten/remove stale facts and add the new fact in one batch.${soft.length ? ` ${soft.join("/")} has only a soft recommendation, never a hard cap.` : ""}`,
    `TARGETS: ${layers.map((layer) => `${layer.name} = ${layer.description}${scopeNote(layer)}`).join(" ")}`,
    "SKIP: task progress, one-off results/scripts, changing state, obvious facts and raw dumps. Never save secret values.",
  ].join("\n");
}

function scopeNote(layer: LayerSpec): string {
  if (layer.path.includes("{project}")) return " (this session's project only; absent without one).";
  if (layer.path.includes("{instance}")) return " (THIS session's bound instance only; no arbitrary instance ID).";
  return "";
}

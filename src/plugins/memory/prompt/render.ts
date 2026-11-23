import type { LayerSpec } from "../../../sessions/memory/layers/layer-types.ts";

/** The `<memory>` policy: how to route writes across the configured layers. */
export function renderMemory(callable: readonly string[], layers: readonly LayerSpec[] | undefined): string {
  if (!callable.includes("memory") || !layers) return "";
  const explicit = layers.filter((layer) => layer.explicitOnly).map((layer) => layer.name);
  return [
    ...(explicit.length ? [`${explicit.join("/")} = how work should be done in every session: rules, boundaries, permissions and working preferences; save with memory only on an explicit user instruction to set or change a rule.`] : []),
    `${layers.filter((layer) => !layer.explicitOnly).map((layer) => layer.name).join("/")} = durable facts that apply regardless of task; pick the most specific layer (machine facts to the instance layer, project facts to the project layer).`,
  ].join("\n");
}

import type { LayerSpec } from "../memory/layers/layer-types.ts";

/** Background review instructions over the layers it may write (`review = true`). */
export function reviewPrompt(layers: readonly LayerSpec[]): string {
  const writable = layers.filter((layer) => layer.review);
  return `PRK background memory review
Review the conversation above and consider saving durable memory if appropriate.
You may write only these layers: ${writable.map((layer) => `${layer.name} = ${layer.description}`).join("; ")}. Route each fact to the most specific one (machine-specific facts to this session's bound instance only, project facts to this session's project only).
Only save knowledge that applies regardless of task. Procedures, judgment, pitfalls, and user preferences or corrections for a class of work belong in that task's skill; this review cannot write skills. Do not save task progress, one-off results/scripts, current state, duplicates or easily rediscovered trivia.
If something stands out, save it once in the right target with the memory tool, consolidating related changes into one batch. If nothing is worth saving, say 'Nothing to save.' and stop.`;
}

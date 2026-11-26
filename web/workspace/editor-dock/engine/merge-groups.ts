import type { EngineContext } from "./engine-types.ts";

export function mergeGroups(ctx: EngineContext) {
  const [first, ...rest] = ctx.api.groups;
  if (!first || !rest.length) return;
  const active = ctx.api.activePanel;
  for (const group of rest) group.api.moveTo({ group: first, position: "center", skipSetActive: true });
  active?.api.setActive();
}

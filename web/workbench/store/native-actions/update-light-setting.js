import { patchSession } from "../updates/patch-session.js";
import { hostState } from "../selection/host-state.js";

export const LIGHT_SETTING_ACTIONS = new Set(["model", "thinking", "tool-mode", "delegation"]);
export const LIGHT_SETTING_FIELDS = { model: "model", thinking: "thinkingLevel", "tool-mode": "toolMode", delegation: "delegation" };

/** Awake light settings update only the snapshot; sleeping settings wait for the Gateway's pushed snapshot. */
export function updateLightSetting(ctx, changes) {
  if (hostState(ctx) === "sleeping") return null;
  const previous = Object.fromEntries(Object.keys(changes).map((field) => [field, ctx.state.session.snapshot?.[field]]));
  const apply = (values) => {
    const snapshot = ctx.state.session.snapshot;
    if (snapshot) patchSession(ctx, { snapshot: { ...snapshot, ...values } });
  };
  apply(changes);
  return () => apply(previous);
}

import type { StoreContext } from "../store-context-types.ts";
import type { LightSettingChanges } from "./native-action-types.ts";
import { patchSession } from "../updates/patch-session.ts";
import { hostState } from "../selection/host-state.ts";

/** The native actions that change a snapshot setting at once: the snapshot field each sets and the argument holding its value. */
export const LIGHT_SETTINGS: Record<string, { field: string; arg: string }> = {
  model: { field: "model", arg: "model" },
  thinking: { field: "thinkingLevel", arg: "level" },
  "tool-mode": { field: "toolMode", arg: "mode" },
  delegation: { field: "delegation", arg: "level" },
};

/** Awake light settings update only the snapshot; sleeping settings wait for the Gateway's pushed snapshot. Returns the rollback. */
export function updateLightSetting(ctx: StoreContext, changes: LightSettingChanges): (() => void) | null {
  if (hostState(ctx) === "sleeping") return null;
  const snapshot = ctx.state.session.snapshot;
  const previous: LightSettingChanges = {
    ...("model" in changes ? { model: snapshot?.model } : {}),
    ...("thinkingLevel" in changes ? { thinkingLevel: snapshot?.thinkingLevel } : {}),
    ...("toolMode" in changes ? { toolMode: snapshot?.toolMode } : {}),
    ...("delegation" in changes ? { delegation: snapshot?.delegation } : {}),
    ...("kernelLanguage" in changes ? { kernelLanguage: snapshot?.kernelLanguage } : {}),
  };
  const apply = (values: LightSettingChanges) => {
    const current = ctx.state.session.snapshot;
    if (current) patchSession(ctx, { snapshot: { ...current, ...values } });
  };
  apply(changes);
  return () => apply(previous);
}

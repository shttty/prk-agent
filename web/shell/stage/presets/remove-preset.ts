import type { SavedPreset } from "./preset-types.ts";
import { savePresets } from "../../layout/save-presets.ts";
import { layout } from "../../layout/layout-store.ts";
import { BUILTIN_PRESETS } from "./builtin-presets.ts";

/** Delete saved layout `name` from `saved` (the list as read) and store the rest; when it was the layout applied last,
 * built-in layout 1 becomes the one new tabs follow. Returns the remaining list. */
export function removePreset(saved: readonly SavedPreset[], name: string) {
  const next = saved.filter((entry) => entry.name !== name);
  savePresets(next);
  if (layout.get().lastPreset === `saved:${name}`) layout.set({ lastPreset: BUILTIN_PRESETS[0]?.id });
  return next;
}

import { savePresets } from "../../layout/layout-store.js";
import { layout } from "../../layout/layout-store.js";
import { BUILTIN_PRESETS } from "./builtin-presets.js";

/** Delete saved layout `name` from `saved` (the list as read) and store the rest; when it was the layout applied last,
 * built-in layout 1 becomes the one new tabs follow. Returns the remaining list. */
export function removePreset(saved, name) {
  const next = saved.filter((entry) => entry.name !== name);
  savePresets(next);
  if (layout.get().lastPreset === `saved:${name}`) layout.set({ lastPreset: BUILTIN_PRESETS[0].id });
  return next;
}

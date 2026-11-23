import { useState } from "react";
import { readPresets } from "../../layout/layout-store.js";
import { savePresets } from "../../layout/layout-store.js";
import { parsePresets } from "./parse-presets.js";
import { removePreset } from "./remove-preset.js";

/** The user's saved layouts (oldest first) with `add(name, layout)` and `remove(name)` (see removePreset); saved at once. */
export function useSavedPresets() {
  const [saved, setSaved] = useState(() => parsePresets(readPresets()));
  return {
    saved,
    add: (name, preset) => { const next = [...saved, { name: name.trim(), layout: preset }]; savePresets(next); setSaved(next); },
    remove: (name) => setSaved(removePreset(saved, name)),
  };
}

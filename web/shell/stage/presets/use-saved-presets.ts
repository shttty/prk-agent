import type { Preset } from "./preset-types.ts";
import { useState } from "react";
import { readPresets } from "../../layout/read-presets.ts";
import { savePresets } from "../../layout/save-presets.ts";
import { parsePresets } from "./parse-presets.ts";
import { removePreset } from "./remove-preset.ts";

/** The user's saved layouts (oldest first) with `add(name, layout)` and `remove(name)` (see removePreset); saved at once. */
export function useSavedPresets() {
  const [saved, setSaved] = useState(() => parsePresets(readPresets()));
  return {
    saved,
    add: (name: string, preset: Preset) => { const next = [...saved, { name: name.trim(), layout: preset }]; savePresets(next); setSaved(next); },
    remove: (name: string) => setSaved(removePreset(saved, name)),
  };
}

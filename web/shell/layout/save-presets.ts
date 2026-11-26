import { PRESETS_KEY } from "./layout-constants.ts";
import { saveDocument } from "./save-document.ts";

export const savePresets = (presets: unknown) => saveDocument(PRESETS_KEY, presets);

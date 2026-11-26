import { PRESETS_KEY } from "./layout-constants.ts";
import { readDocument } from "./read-document.ts";

export const readPresets = () => readDocument(PRESETS_KEY);

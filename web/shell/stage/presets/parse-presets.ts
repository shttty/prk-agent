import type { SavedPreset } from "./preset-types.ts";
import { isRecord } from "../../../workspace/editor-layout/is-record.ts";
import { validLayout } from "./valid-layout.ts";

/** The saved layouts as stored (`[{ name, layout }]`, oldest first); entries this module did not write are skipped. */
export const parsePresets = (saved: unknown): SavedPreset[] => (Array.isArray(saved) ? saved.filter((entry): entry is SavedPreset => isRecord(entry) && typeof entry.name === "string" && Boolean(entry.name.trim()) && validLayout(entry.layout)) : []);

import type { Draft, TextEntry } from "../ask-types.ts";
import { filled } from "./filled.ts";
/** Typing the "other" text makes it the single-select answer; clearing it hands the answer back to the selected option. */
export function setCustom(draft: Draft, custom: TextEntry): Draft {
  return { ...draft, custom, pick: filled(custom) ? "other" : "option" };
}

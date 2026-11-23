import { filled } from "./tab-label.js";
/** Typing the "other" text makes it the single-select answer; clearing it hands the answer back to the selected option. */
export function setCustom(draft, custom) {
  return { ...draft, custom, pick: filled(custom) ? "other" : "option" };
}

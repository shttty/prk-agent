import type { Draft } from "../ask-types.ts";

/**
 * What the user has entered for one question. `selected` are option indexes; `pick` says which of a single-select
 * question's two exclusive answers counts (a listed option or the free-text "other") without throwing the other away;
 * `note` belongs to the option at `note.row`.
 */
export const blankDraft = (): Draft => ({ selected: [], pick: "option", custom: { text: "" }, note: { row: null, text: "" } });

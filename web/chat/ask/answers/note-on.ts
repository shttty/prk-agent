import type { Draft } from "../ask-types.ts";

/** The note moves to `row` (keeping its text) when another option asks for it. */
export const noteOn = (draft: Draft, row: number): Draft => (draft.note.row === row ? draft : { ...draft, note: { ...draft.note, row } });

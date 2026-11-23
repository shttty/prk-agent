
/** The note moves to `row` (keeping its text) when another option asks for it. */
export const noteOn = (draft, row) => (draft.note.row === row ? draft : { ...draft, note: { ...draft.note, row } });

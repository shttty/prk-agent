// What an ask dialog's draft amounts to (web/chat/ask.js): which answer counts, what is sent.
import assert from "node:assert/strict";
import { answersPayload } from "../../web/chat/ask/answers/answers-payload.js";
import { blankDraft } from "../../web/chat/ask/answers/blank-draft.js";
import { effectiveAnswer } from "../../web/chat/ask/answers/effective-answer.js";
import { isAnswered } from "../../web/chat/ask/answers/is-answered.js";
import { isDirect } from "../../web/chat/ask/answers/is-direct.js";
import { noteOn } from "../../web/chat/ask/answers/note-on.js";
import { selectOption } from "../../web/chat/ask/answers/select-option.js";
import { setCustom } from "../../web/chat/ask/answers/set-custom.js";
import { tabLabel } from "../../web/chat/ask/answers/tab-label.js";

const single = { id: "db", question: "Which database should the service use for the first release?", options: [{ label: "A" }, { label: "B" }, { label: "C" }] };
const multi = { id: "features", question: "Which?", multi: true, options: [{ label: "x" }, { label: "y" }, { label: "z" }] };
const text = (value) => ({ text: value });

// Tab labels: header, else the question cut short on one line.
assert.equal(tabLabel({ ...single, header: " Storage " }, 0), "Storage");
assert.equal(tabLabel(single, 0), "Which databa…");
assert.equal(tabLabel({ ...single, question: "Short?" }, 0), "Short?");

// Only one single-select question skips the review tab; several questions or a multi-select one keep it.
assert.equal(isDirect([single]), true);
assert.equal(isDirect([multi]), false);
assert.equal(isDirect([single, single]), false);
assert.equal(isDirect([]), false);

// Nothing is chosen until the user chooses, whatever `recommended` says.
assert.equal(isAnswered(effectiveAnswer({ ...single, recommended: 1 }, blankDraft())), false);

// Single select: the last option wins; the free-text answer is exclusive with it but neither is thrown away.
let draft = selectOption(single, blankDraft(), 0);
draft = selectOption(single, draft, 2);
assert.deepEqual(effectiveAnswer(single, draft).selected, [2]);
draft = setCustom(draft, text("my own"));
assert.deepEqual(effectiveAnswer(single, draft).selected, []);
assert.equal(effectiveAnswer(single, draft).custom.text, "my own");
draft = selectOption(single, draft, 1);
assert.deepEqual(effectiveAnswer(single, draft).selected, [1], "choosing an option takes the answer back");
assert.equal(effectiveAnswer(single, draft).custom, null);
assert.equal(draft.custom.text, "my own", "the typed text stays for when the user returns to it");
draft = setCustom(draft, text("   "));
assert.deepEqual(effectiveAnswer(single, draft).selected, [1], "clearing the text hands the answer back to the option");

// Multi select: toggles, reported in option order, and the free-text answer sits next to them.
let many = selectOption(multi, blankDraft(), 2);
many = selectOption(multi, many, 0);
many = selectOption(multi, many, 2);
many = selectOption(multi, many, 1);
assert.deepEqual(effectiveAnswer(multi, many).selected, [0, 1]);
many = setCustom(many, text("extra"));
assert.deepEqual([effectiveAnswer(multi, many).selected, effectiveAnswer(multi, many).custom.text], [[0, 1], "extra"]);
assert.equal(isAnswered(effectiveAnswer(multi, blankDraft())), false, "an empty multi-select is unanswered");

// A note counts only while its option is selected, follows the option that asks for it and keeps its text.
let noted = selectOption(single, blankDraft(), 1);
noted = noteOn(noted, 1);
noted = { ...noted, note: { ...noted.note, text: "because" } };
assert.equal(effectiveAnswer(single, noted).note.text, "because");
assert.equal(effectiveAnswer(single, selectOption(single, noted, 0)).note, null, "selecting another option drops the note of the first");
assert.equal(effectiveAnswer(single, selectOption(single, selectOption(single, noted, 0), 1)).note.text, "because", "and it is back when that option is");
assert.equal(noteOn(noted, 2).note.text, "because");
assert.equal(noteOn(noted, 2).note.row, 2);
assert.equal(effectiveAnswer(single, { ...noted, note: { ...noted.note, text: "" } }).note, null, "an empty note is no note");

// The payload: one entry per question in order, only what counts.
const drafts = { db: noted, features: setCustom(selectOption(multi, blankDraft(), 1), text("extra")) };
assert.deepEqual(answersPayload([single, multi], drafts), [
  { id: "db", selected: [1], note: { text: "because" } },
  { id: "features", selected: [1], custom: { text: "extra" } },
]);
assert.deepEqual(answersPayload([single], { db: blankDraft() }), [{ id: "db", selected: [] }], "an unanswered question is still sent, empty");
console.log("PASS ask logic");

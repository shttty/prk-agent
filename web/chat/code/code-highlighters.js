import { tagHighlighter } from "@lezer/highlight";
import { tags } from "@lezer/highlight";
import { classHighlighter } from "@lezer/highlight";
// classHighlighter has no "function" class; add one so calls and definitions can stand out.
export const functionHighlighter = tagHighlighter([
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], class: "tok-function" },
]);

/** The class highlighters both the static tool bodies and the file editor use; colours come from chat.css (`--pi-syn-*`). */
export const codeHighlighters = [classHighlighter, functionHighlighter];

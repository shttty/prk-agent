import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightTree } from "@lezer/highlight";
import { codeHighlighters } from "./code-highlighters.js";
// Above this the synchronous parse could stall the page; the caller falls back to plain text.
export const MAX_HIGHLIGHT_CHARS = 120_000;

export function describe({ name, filename }) {
  if (name) return LanguageDescription.matchLanguageName(languages, name, true);
  if (filename) return LanguageDescription.matchFilename(languages, filename);
  return null;
}

/** Highlight `code` and return per-line segments `[[text, className], …][]`, or null when the language is unknown. */
export async function highlightLines(code, query) {
  if (code.length > MAX_HIGHLIGHT_CHARS) return null;
  const description = describe(query);
  if (!description) return null;
  const support = await description.load();
  const tree = support.language.parser.parse(code);
  const lines = [[]];
  let position = 0;
  const push = (text, cls) => {
    const parts = text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push([part, cls]);
    });
  };
  highlightTree(tree, codeHighlighters, (from, to, cls) => {
    if (from > position) push(code.slice(position, from), "");
    push(code.slice(from, to), cls);
    position = to;
  });
  if (position < code.length) push(code.slice(position), "");
  return lines;
}

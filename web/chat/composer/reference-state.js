import { referenceToken } from "./references/reference-token.js";
export function referenceState(ctx) {
  const { composerText, candidates, popupDismissed } = ctx;
  const referenceQuery = referenceToken(composerText);
  const references = candidates;
  const referenceMenuOpen = !popupDismissed && referenceQuery !== null;
  // What the user typed up to the last "/" (relative or /abs): picked names are appended to it as written.
  const referenceBase = referenceQuery === null ? "" : referenceQuery.slice(0, referenceQuery.lastIndexOf("/") + 1);
  return { referenceQuery, references, referenceMenuOpen, referenceBase };
}

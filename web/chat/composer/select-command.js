export function selectCandidate({ setComposerText, setCandidateIndex, setPopupDismissed }, candidate) {
  if (!candidate) return;
  setComposerText(`${candidate.prefix || "/"}${candidate.name} `);
  setCandidateIndex(0);
  setPopupDismissed(false);
}

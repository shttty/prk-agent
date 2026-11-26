import type { ComposerCommand, Setter } from "./composer-types.ts";

type SelectCommand = { setComposerText: (text: string) => void; setCandidateIndex: Setter<number>; setPopupDismissed: Setter<boolean> };

export function selectCandidate({ setComposerText, setCandidateIndex, setPopupDismissed }: SelectCommand, candidate: ComposerCommand | undefined) {
  if (!candidate) return;
  setComposerText(`${candidate.prefix || "/"}${candidate.name} `);
  setCandidateIndex(0);
  setPopupDismissed(false);
}

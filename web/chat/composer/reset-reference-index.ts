import type { ReferenceCandidateView, Setter } from "./composer-types.ts";
import { referenceAvailable } from "./references/reference-available.ts";
export function resetReferenceIndex({ setReferenceIndex, references }: { setReferenceIndex: Setter<number>; references: readonly ReferenceCandidateView[] }) { setReferenceIndex(Math.max(0, references.findIndex(referenceAvailable))); }

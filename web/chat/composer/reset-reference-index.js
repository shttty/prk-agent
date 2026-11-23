import { referenceAvailable } from "./references/reference-available.js";
export function resetReferenceIndex({ setReferenceIndex, references }) { setReferenceIndex(Math.max(0, references.findIndex(referenceAvailable))); }

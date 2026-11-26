import type { ReferenceCandidateView } from "../composer-types.ts";

/** A target candidate can be navigated into (directory) or attached (file); anything else (socket, device) is neither. */
export const referenceAvailable = (reference: ReferenceCandidateView | undefined): boolean => reference?.navigable === true || reference?.selectable === true;

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { PresentationAnchor, SavedPresentation } from "./presentation-types.ts";

/** A disclosure toggled by the reader: where it was, so the scroll can keep it there. */
export type PendingDisclosure = { node: Element; top: number; scrollTop: number };
export type ScrollIntent = { touchY: number | null; scrollbar: boolean };
export type ScrollRef<T> = { current: T };
export type ViewportRef = RefObject<HTMLDivElement | null>;
export type SetState<T> = Dispatch<SetStateAction<T>>;
export type RestoredPresentation = { streamId: string | null; revision: number };
/** What TranscriptList lets the chat surface do to the virtual list. */
export type TranscriptListHandle = {
  pin: () => void;
  scrollTo: (offset: number) => void;
  revealMessage: (id: string | undefined, options?: RevealOptions) => boolean;
  cancelReveal: () => void;
  beforePrepend: () => void;
};
export type RevealOptions = { offset?: number; openDetails?: boolean; prepare?: (row: HTMLElement) => Element | null; onReveal?: () => void };
export type { PresentationAnchor, SavedPresentation };

import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import type { ChatAttachment, ChatReference } from "../thread/chat-state-types.ts";
import type { useAttachmentInput } from "./attachments/use-attachment-input.ts";
import type { AttachmentLimits, ComposerCommand, ExtensionCompletion, ExtensionCompletionItem, QueueMode, ReferenceCandidateView, Setter } from "./composer-types.ts";

/** What ComposerDock hands the composer form and its menus: draft state, menu state and the handlers that change them. */
export type ComposerModel = {
  busy: boolean; cancelling: boolean; compacting: boolean;
  referenceMenuOpen: boolean; referenceListRef: RefObject<HTMLDivElement | null>; references: ReferenceCandidateView[];
  referenceCandidates: { loading: boolean; error: { reason?: string; text: string } | null; truncated: boolean };
  referenceIndex: number; setReferenceIndex: Setter<number>; selectReference: (reference: ReferenceCandidateView | undefined) => void;
  submitDraft: (event: FormEvent) => void; popupDismissed: boolean;
  extensionCompletion: ExtensionCompletion | null; extensionListRef: RefObject<HTMLDivElement | null>; extensionIndex: number; setExtensionIndex: Setter<number>;
  applyExtensionCompletion: (item: ExtensionCompletionItem) => Promise<void>;
  commandMenuOpen: boolean; candidateOptions: ComposerCommand[]; candidateIndex: number; selectCandidate: (command: ComposerCommand | undefined) => void;
  setCandidateIndex: Setter<number>; setHelpCommand: Setter<ComposerCommand | null>;
  plainSuggested: boolean; commandElsewhere: string | null; unknownControl: boolean; normalizedComposerText: string; plainMode: boolean; setPlainMode: Setter<boolean>;
  replaceReference: (reference: ChatReference, index: number) => void;
  attach: ReturnType<typeof useAttachmentInput>; attachments: ChatAttachment[]; attachedReferences: ChatReference[]; catalogAttachments: AttachmentLimits | undefined;
  status: string | undefined; connected: boolean; queueMode: QueueMode; composerText: string;
  inputChanged: (event: ChangeEvent<HTMLTextAreaElement>) => void; setExtensionCursor: Setter<number>; composingRef: RefObject<boolean>; setComposition: Setter<boolean>;
  uploadFiles: (files: Iterable<File> | ArrayLike<File>) => Promise<void>;
  resumable: boolean; sleeping: boolean; selectedSessionId: string; uiLoading: boolean;
  handleInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void; setComposerValue: (value: unknown) => void;
  findCurrentPage: () => void; setShortcutsOpen: Setter<boolean>; hasDraft: boolean; submitting: boolean; otherQueue: QueueMode;
};

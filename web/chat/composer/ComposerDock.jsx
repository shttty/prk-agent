import { memo } from "react";
import { useState } from "react";
import { useRef } from "react";
import { useCallback } from "react";
import { useLayoutEffect } from "react";
import { useEffect } from "react";
import { useAui } from "@assistant-ui/react";
import { safeText } from "../../workbench/payloads/safe-text.js";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { extensionUiInitializing } from "../thread/extension-ui-initializing.js";
import { isResumableSession } from "../conversation/is-resumable-session.js";
import { referenceState } from "./reference-state.js";
import { CommandHelpModal } from "./CommandHelpModal.jsx";
import { ShortcutsModal } from "./ShortcutsModal.jsx";
import { resetExtensionIndex as resetExtensionIndexBody } from "./reset-extension-index.js";
import { revealExtensionSelection as revealExtensionSelectionBody } from "./reveal-extension-selection.js";
import { resetReferenceIndex as resetReferenceIndexBody } from "./reset-reference-index.js";
import { revealReferenceSelection as revealReferenceSelectionBody } from "./reveal-reference-selection.js";
import { loadExtensionCompletion as loadExtensionCompletionBody } from "./load-extension-completion.js";
import { loadReferenceCandidates as loadReferenceCandidatesBody } from "./load-reference-candidates.js";
import { syncComposerText as syncComposerTextBody } from "./sync-composer-text.js";
import { applyExtensionCompletion as applyExtensionCompletionBody } from "./apply-extension-completion.js";
import { selectCandidate as selectCandidateBody } from "./select-command.js";
import { selectReference as selectReferenceBody } from "./select-reference.js";
import { replaceReference as replaceReferenceBody } from "./replace-reference.js";
import { sendDraft as sendDraftBody } from "./send-draft.js";
import { submitDraft as submitDraftBody } from "./submit-draft.js";
import { setComposerValue as setComposerValueBody } from "./set-composer-value.js";
import { recallPrompt as recallPromptBody } from "./recall-prompt.js";
import { handleInputKeyDown as handleInputKeyDownBody } from "./handle-input-key-down.js";
import { useComposerDialogs } from "./use-composer-dialogs.js";
import { useComposerAttachments } from "./use-composer-attachments.js";
import { useCommandMenu } from "./use-command-menu.js";
import { composerMode } from "./composer-mode.js";
import { useComposerText } from "./use-composer-text.js";
import { usePromptHistory } from "./use-prompt-recall.js";
import { composerInputChanged } from "./composer-input-changed.js";
import { useBusy } from "./use-busy.js";
import { Composer } from "./Composer.jsx";
/**
 * Composer region: owns the draft and everything that follows it (command, reference and plugin completion menus,
 * prompt recall, attachments, sending). It subscribes to its own store fields, so typing re-renders only this region.
 * `onFindInPage` opens the transcript search; `onSend` lets the transcript follow the message being sent.
 */
export const ComposerDock = memo(function ComposerDock({ actions, onFindInPage, onSend }) {
  const aui = useAui();
  const composerText = useWorkbench((state) => state.draft);
  const selectedSessionId = useWorkbench((state) => safeText(state.selectedSessionId));
  const status = useWorkbench((state) => state.session.snapshot?.state || state.sessions.get(state.selectedSessionId)?.state);
  const rowTarget = useWorkbench((state) => state.sessions.get(state.selectedSessionId)?.target);
  const rowSessionId = useWorkbench((state) => state.sessions.get(state.selectedSessionId)?.sessionId);
  const snapshotSessionId = useWorkbench((state) => state.session.snapshot?.sessionId);
  const streamId = useWorkbench((state) => state.session.streamId);
  const submitting = useWorkbench((state) => state.session.pending.has("sending"));
  const connected = useWorkbench((state) => state.session.connection === "connected");
  const catalog = useWorkbench((state) => state.session.nativeCatalog?.value);
  const referenceCandidates = useWorkbench((state) => state.session.referenceCandidates);
  const autocomplete = useWorkbench((state) => state.session.extensionUi?.autocomplete);
  const plainSendAvailable = useWorkbench((state) => state.session.banner?.plainSendAvailable === true);
  const queue = useWorkbench((state) => state.queue);
  const attachments = useWorkbench((state) => state.attachments);
  const attachedReferences = useWorkbench((state) => state.references);
  const messages = useWorkbench((state) => state.session.snapshot?.messages);
  const uiLoading = useWorkbench(extensionUiInitializing);
  const resumable = useWorkbench(isResumableSession);
  const { busy, cancelling } = useBusy();
  const compacting = useWorkbench((state) => state.session.snapshot?.operation?.kind === "compact");
  const sleeping = status === "sleeping";
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const [referenceIndex, setReferenceIndex] = useState(0);
  const referenceListRef = useRef(null);
  const [plainMode, setPlainMode] = useState(false);
  const [composition, setComposition] = useState(false);
  const composingRef = useRef(false);
  const { helpCommand, setHelpCommand, shortcutsOpen, setShortcutsOpen } = useComposerDialogs();
  const [historyCursor, setHistoryCursor] = useState(null);
  const { attach } = useComposerAttachments({ attachments, limits: catalog?.attachments, actions });
  const [extensionCompletion, setExtensionCompletion] = useState(null);
  const [extensionCursor, setExtensionCursor] = useState(0);
  const [extensionIndex, setExtensionIndex] = useState(0);
  const extensionListRef = useRef(null);
  useEffect(() => { return resetExtensionIndexBody({ setExtensionIndex }); }, [extensionCompletion]);
  useEffect(() => { return revealExtensionSelectionBody({ extensionListRef }); }, [extensionIndex]);
  const completionRequest = useRef(0);
  const { normalizedComposerText, candidateOptions, activeCommand, commandElsewhere, commandMenuOpen } = useCommandMenu({ composerText, commands: catalog?.commands, popupDismissed });
  const { referenceQuery, references, referenceMenuOpen, referenceBase } = referenceState({ composerText, candidates: referenceCandidates.value, popupDismissed });
  useEffect(() => { return resetReferenceIndexBody({ setReferenceIndex, references }); }, [references]);
  useEffect(() => { return revealReferenceSelectionBody({ referenceListRef }); }, [referenceIndex, references]);
  const { unknownControl, plainSuggested, queueMode, otherQueue, hasDraft } = composerMode({ normalizedComposerText, candidateOptions, activeCommand, composerText, plainSendAvailable, queue, attachments });
  useEffect(() => { return loadExtensionCompletionBody({ completionRequest, setExtensionCompletion, autocomplete, composerText, extensionCursor, actions }); }, [actions, composerText, extensionCursor, selectedSessionId, streamId, autocomplete]);
  useEffect(() => { return loadReferenceCandidatesBody({ referenceQuery, actions }); }, [actions, referenceQuery, selectedSessionId, streamId, snapshotSessionId, rowTarget]);
  useLayoutEffect(() => { return syncComposerTextBody({ aui, composerText }); }, [aui, composerText, selectedSessionId]);
  const { setComposerText } = useComposerText({ aui, actions });
  const applyExtensionCompletion = useCallback((item) => { return applyExtensionCompletionBody({ composerText, extensionCursor, actions, extensionCompletion: { prefix: extensionCompletion.prefix }, setComposerText, setExtensionCompletion, setPopupDismissed, setExtensionCursor }, item); }, [actions, composerText, extensionCompletion?.prefix, extensionCursor, setComposerText]);
  const selectCandidate = useCallback((candidate) => { return selectCandidateBody({ setComposerText, setCandidateIndex, setPopupDismissed }, candidate); }, [setComposerText]);
  /** A directory opens in place (`@<dir>/`, menu stays); a file ends the token (`@<file> `) and becomes a reference. */
  const selectReference = useCallback((reference) => { return selectReferenceBody({ referenceBase, setComposerText, composerText, setPopupDismissed, rowTarget, rowSessionId, snapshotSessionId, attachedReferences, actions }, reference); }, [actions, composerText, referenceBase, setComposerText, attachedReferences, snapshotSessionId, rowTarget, rowSessionId]);
  const replaceReference = useCallback((reference, index) => { return replaceReferenceBody({ composerText, actions, attachedReferences, setComposerText, setPopupDismissed }, reference, index); }, [actions, composerText, setComposerText, attachedReferences]);
  const sendDraft = useCallback((sendQueue = queueMode) => { if (compacting) return; return sendDraftBody({ composerText, composingRef, selectedSessionId, submitting, uiLoading, onSend, actions, plainMode, attachments, attachedReferences, setPlainMode, setHistoryCursor }, sendQueue); }, [actions, compacting, composerText, plainMode, queueMode, selectedSessionId, submitting, uiLoading, onSend, attachments, attachedReferences]);
  const submitDraft = useCallback((event) => { return submitDraftBody({ sendDraft }, event); }, [sendDraft]);
  const { promptHistory } = usePromptHistory({ messages });
  const setComposerValue = useCallback((value) => { return setComposerValueBody({ setComposerText, setPopupDismissed }, value); }, [setComposerText]);
  /** Shell-style prompt recall: ArrowUp from an empty composer walks back through sent prompts. */
  const recallPrompt = useCallback((delta) => { return recallPromptBody({ promptHistory, historyCursor, setHistoryCursor, setComposerValue }, delta); }, [historyCursor, promptHistory, setComposerValue]);
  const handleInputKeyDown = useCallback((event) => { return handleInputKeyDownBody({ composingRef, composition, referenceMenuOpen, setPopupDismissed, references, referenceIndex, setReferenceIndex, referenceCandidates: { error: referenceCandidates.error, loading: referenceCandidates.loading }, selectReference, popupDismissed, extensionCompletion, applyExtensionCompletion, extensionIndex, commandMenuOpen, setExtensionIndex, setCandidateIndex, candidateOptions, candidateIndex, selectCandidate, composerText, historyCursor, recallPrompt, sendDraft, busy, otherQueue, queueMode }, event); }, [applyExtensionCompletion, extensionCompletion, extensionIndex, busy, candidateIndex, candidateOptions, commandMenuOpen, composerText, composition, historyCursor, otherQueue, popupDismissed, queueMode, recallPrompt, referenceIndex, referenceMenuOpen, references, selectCandidate, selectReference, sendDraft, referenceCandidates.error, referenceCandidates.loading]);
  const { inputChanged } = composerInputChanged({ setExtensionCursor, setComposerText, setCandidateIndex, setHistoryCursor, setPopupDismissed });
  const model = { busy, cancelling, compacting, referenceMenuOpen, referenceListRef, references, referenceCandidates, referenceIndex, setReferenceIndex, selectReference, submitDraft, popupDismissed, extensionCompletion, extensionListRef, extensionIndex, setExtensionIndex, applyExtensionCompletion, commandMenuOpen, candidateOptions, candidateIndex, selectCandidate, setCandidateIndex, setHelpCommand, plainSuggested, commandElsewhere, unknownControl, normalizedComposerText, plainMode, setPlainMode, replaceReference, attach, attachments, attachedReferences, catalogAttachments: catalog?.attachments, status, connected, queueMode, composerText, inputChanged, setExtensionCursor, composingRef, setComposition, uploadFiles: attach.add, resumable, sleeping, selectedSessionId, uiLoading, handleInputKeyDown, setComposerValue, findCurrentPage: onFindInPage, setShortcutsOpen, hasDraft, submitting, otherQueue };
  return <>
    <Composer actions={actions} model={model} />
    <ShortcutsModal opened={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    <CommandHelpModal command={helpCommand} onClose={() => setHelpCommand(null)} onUse={(command) => { setHelpCommand(null); selectCandidate(command); window.setTimeout(() => document.getElementById("composer")?.focus(), 0); }} />
  </>;
});

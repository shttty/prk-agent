import "./composer.css";
import { Text } from "@mantine/core";
import { Button } from "@mantine/core";
import { Group } from "@mantine/core";
import { Badge } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { Textarea } from "@mantine/core";
import { VisuallyHidden } from "@mantine/core";
import { Menu } from "@mantine/core";
import { Tooltip } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { IconX } from "@tabler/icons-react";
import { IconPlus } from "@tabler/icons-react";
import { IconPaperclip } from "@tabler/icons-react";
import { IconSlash } from "@tabler/icons-react";
import { IconSearch } from "@tabler/icons-react";
import { IconKeyboard } from "@tabler/icons-react";
import { IconPlayerStopFilled } from "@tabler/icons-react";
import { IconArrowUp } from "@tabler/icons-react";
import { ComposerPrimitive } from "@assistant-ui/react";
import { AttachmentChips } from "./attachments/AttachmentChips.tsx";
import { MAX_TEXT } from "./composer-constants.ts";
import { CommandMenu } from "./commands/CommandMenu.tsx";
import { QUEUE_LABELS } from "./composer-constants.ts";
import { QUEUE_SHORT } from "./composer-constants.ts";
import { ExtensionCompletionMenu } from "./extension-completion/ExtensionCompletionMenu.tsx";
import { ReferenceMenu } from "./references/ReferenceMenu.tsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.ts";
import { useStopTarget } from "../../workbench/subscription/use-stop-target.js";
import { useElementSize } from "@mantine/hooks";
import { useMediaQuery } from "@mantine/hooks";
import { ComposerSettings } from "./meta/ComposerSettings.tsx";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import type { ComposerModel } from "./composer-model-types.ts";
import type { ComposerTier } from "./meta/composer-tier.ts";
import type { KeyboardEvent } from "react";
/** The composer form; ComposerDock owns its state and passes it as `model`. */
export function Composer({ actions, model }: { actions: ChatActions; model: ComposerModel }) {
  const { submitDraft, busy, commandMenuOpen, candidateOptions, candidateIndex, selectCandidate, setCandidateIndex, setHelpCommand, referenceMenuOpen, references, referenceCandidates, referenceIndex, plainSuggested, commandElsewhere, unknownControl, normalizedComposerText, plainMode, setPlainMode, replaceReference, attach, attachments, attachedReferences, catalogAttachments, status, connected, queueMode, composerText, inputChanged, setExtensionCursor, composingRef, setComposition, uploadFiles, resumable, sleeping, selectedSessionId, uiLoading, handleInputKeyDown, setComposerValue, findCurrentPage, setShortcutsOpen, cancelling, hasDraft, submitting, otherQueue, compacting } = model;
  const stopTarget = useStopTarget();
  const maxBytes = catalogAttachments?.maxAugmentedMessageBytes;
  const stopping = useWorkbench((state) => state.session.pending.has("stopping"));
  const canStop = Boolean(stopTarget && connected && !cancelling && !stopping);
  const footer = useElementSize();
  const phone = useMediaQuery("(max-width: 700px)", false, { getInitialValueInEffect: false });
  // Row width in px (0 before the first measurement) decides which settings are shown or shortened beside "+" and send:
  // it switches content, not position, so layout components cannot replace it.
  const tier: ComposerTier = phone ? "phone" : !footer.width || footer.width >= 640 ? "full" : footer.width >= 480 ? "short" : footer.width >= 380 ? "tight" : "folded";
  const onStop = () => { if (canStop) void actions.cancelOperation(stopTarget); };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Escape") return submitting ? undefined : handleInputKeyDown(event);
    if (event.defaultPrevented || composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if ([...document.querySelectorAll('[role="dialog"], [data-portal] [role="menu"], .mantine-Popover-dropdown')].some((node) => node.checkVisibility({ visibilityProperty: true }))) return;
    handleInputKeyDown(event);
    if (!event.defaultPrevented && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && canStop) {
      event.preventDefault();
      onStop();
    }
  };
  return (
    <ComposerPrimitive.Root id="composer-form" className="pi-composer composer" onSubmit={submitDraft} data-busy={busy ? "true" : undefined}>
              <ExtensionCompletionMenu model={model} />
              {commandMenuOpen ? <CommandMenu candidates={candidateOptions} activeIndex={candidateIndex} onSelect={selectCandidate} onHover={setCandidateIndex} onHelp={setHelpCommand} /> : null}
              <ReferenceMenu model={model} />
              {plainSuggested ? <Group className="pi-composer-hint" gap="xs" wrap="nowrap">
                <Text size="xs" c="dimmed">{commandElsewhere || (unknownControl ? `没有 ${normalizedComposerText.split(/\s/)[0]} 这个命令。` : "这段开头会被当作原生输入。")}</Text>
                <Button id="send-as-plain" type="button" variant={plainMode ? "filled" : "subtle"} size="compact-xs" onClick={() => setPlainMode((value) => !value)} aria-pressed={plainMode}>按普通文本发送</Button>
              </Group> : null}
              {attachedReferences?.length ? <Group className="pi-reference-list" gap={4}>{attachedReferences.map((reference, index) => <Badge key={`${reference.type}-${index}`} variant="light" title={`${reference.source || "引用"} · ${reference.target || ""} · ${reference.sessionId || ""} · ${reference.path || reference.name || ""}`} rightSection={<Group gap={0}><ActionIcon size="xs" variant="subtle" onClick={() => replaceReference(reference, index)} aria-label={`替换引用 ${reference.name || reference.path || index + 1}`} title="替换引用">替</ActionIcon><ActionIcon size="xs" variant="subtle" data-action="remove-reference" onClick={() => actions.setReferences(attachedReferences.filter((_, itemIndex) => itemIndex !== index))} aria-label={`移除引用 ${reference.name || reference.path || index + 1}`} title="移除引用"><IconX size={11} /></ActionIcon></Group>}>{reference.source || "引用"}: {reference.name || reference.path || reference.text?.slice(0, 32) || reference.type}</Badge>)}</Group> : null}
              <AttachmentChips attachments={attachments} title={maxBytes !== undefined && Number.isSafeInteger(maxBytes) ? `正文、文本附件和引用合计上限 ${Math.floor(maxBytes / 1024)} KiB，图片另计。` : undefined} onReplace={attach.open} onRemove={(index) => actions.setAttachments(attachments.filter((_, itemIndex) => itemIndex !== index))} />
              {attach.error ? <InlineAlert className="pi-upload-error">{attach.error}</InlineAlert> : null}
              <ComposerPrimitive.Input
                asChild
                id="composer"
                data-status={status}
                data-sending={submitting ? true : undefined}
                readOnly={submitting}
                data-queue={queueMode}
                value={composerText}
                onFocus={sleeping ? () => void actions.wakeSession() : undefined}
                onChange={(event) => {
                  if (sleeping) void actions.wakeSession();
                  inputChanged(event);
                }}
                onSelect={(event) => setExtensionCursor(event.currentTarget.selectionStart)}
                onCompositionStart={() => { composingRef.current = true; setComposition(true); }}
                onCompositionEnd={() => { composingRef.current = false; setComposition(false); }}
                onPaste={(event) => { const files = [...(event.clipboardData?.files || [])]; if (files.length) { event.preventDefault(); void uploadFiles(files); } }}
                onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer?.files || []); }}
                onDragOver={(event) => event.preventDefault()}
                maxLength={MAX_TEXT}
                placeholder={resumable ? "发消息即恢复执行环境" : sleeping ? "会话休眠中，输入时自动唤醒" : compacting ? "压缩中，结束后可发送" : busy ? `运行中，发送会${QUEUE_LABELS[queueMode]}` : "发消息，/ 调出命令，@ 引用文件"}
                disabled={!selectedSessionId || uiLoading}
                submitMode="none"
                spellCheck={false}
                cancelOnEscape={false}
                autoFocus={false}
                onKeyDown={onKeyDown}
                aria-label="发送给助手的任务"
                aria-controls={referenceMenuOpen ? "native-reference-list" : "native-candidate-list"}
                aria-activedescendant={referenceMenuOpen && !referenceCandidates.loading && !referenceCandidates.error && references[referenceIndex] ? `native-reference-option-${referenceIndex}` : undefined}
                aria-expanded={commandMenuOpen || referenceMenuOpen}
              >
                <Textarea rows={1} className="pi-composer-input" />
              </ComposerPrimitive.Input>
              <Group ref={footer.ref} className="pi-composer-footer composer-footer" gap={6} wrap="nowrap">
                <VisuallyHidden id="input-count">{composerText.length} / {MAX_TEXT}</VisuallyHidden>
                <input {...attach.inputProps} />
                {/* Menu.Target overwrites its child's id with the menu id, so the stable id lives on Menu. */}
                <Menu id="composer-add" position="top-start" offset={8} withinPortal shadow="md" width={220}>
                  <Menu.Target>
                    <ActionIcon className="pi-composer-add" type="button" variant="subtle" radius="xl" size={34} disabled={!selectedSessionId} aria-label="添加"><IconPlus size={18} stroke={1.8} /></ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item id="upload-attachment" leftSection={<IconPaperclip size={16} stroke={1.7} />} disabled={catalogAttachments?.enabled === false} onClick={() => attach.open()}>添加图片或文件</Menu.Item>
                    <Menu.Item leftSection={<IconSlash size={16} stroke={1.7} />} onClick={() => { setComposerValue("/"); window.setTimeout(() => document.getElementById("composer")?.focus(), 0); }}>命令</Menu.Item>
                    <Menu.Item id="find-current-page" leftSection={<IconSearch size={16} stroke={1.7} />} onClick={findCurrentPage}>查找当前页</Menu.Item>
                    <Menu.Item id="open-shortcuts" leftSection={<IconKeyboard size={16} stroke={1.7} />} onClick={() => setShortcutsOpen(true)}>快捷键</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
                <ComposerSettings actions={actions} tier={tier} />
                <Group gap={6} wrap="nowrap">
                  {busy || stopTarget?.cell ? <Tooltip label="停止任务" openDelay={400}><ActionIcon id="cancel-operation" className="pi-composer-stop" type="button" variant="filled" radius="xl" size={34} onClick={onStop} disabled={!canStop} aria-label="停止任务"><IconPlayerStopFilled size={14} /></ActionIcon></Tooltip> : null}
                  {busy && !compacting
                    ? <Button id="send-message" className={`pi-composer-send is-queue${hasDraft ? "" : " is-idle-hidden"}`} type="submit" radius="xl" size="compact-md" loading={submitting} rightSection={<IconArrowUp size={15} stroke={2} />} disabled={!hasDraft || !selectedSessionId || submitting || uiLoading} aria-label="发送消息" title={`Enter ${QUEUE_LABELS[queueMode]} · Ctrl+Enter ${QUEUE_LABELS[otherQueue]}`} data-queue={queueMode}>{QUEUE_SHORT[queueMode]}</Button>
                    : <ActionIcon id="send-message" className="pi-composer-send" type="submit" variant="filled" radius="xl" size={34} loading={submitting} disabled={compacting || !hasDraft || !selectedSessionId || submitting || uiLoading} aria-label="发送消息" title="发送（Enter）"><IconArrowUp size={18} stroke={2} /></ActionIcon>}
                </Group>
              </Group>
            </ComposerPrimitive.Root>
  );
}

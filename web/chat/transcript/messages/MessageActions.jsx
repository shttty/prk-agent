import { useContext } from "react";
import { useState } from "react";
import { Tooltip } from "@mantine/core";
import { Group } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { IconGitFork } from "@tabler/icons-react";
import { IconRefresh } from "@tabler/icons-react";
import { IconPencil } from "@tabler/icons-react";
import { useAuiState } from "@assistant-ui/react";
import { contentText } from "../../conversation/content-text.js";
import { copyLiteral } from "../../clipboard/copy-literal.js";
import { safeText } from "../../../workbench/payloads/safe-text.js";
import { PresentationContext } from "../presentation-context.js";
import { useFeedback } from "./use-feedback.js";
import { RERUN_LABELS } from "./RerunDialog.jsx";
import { RerunDialog } from "./RerunDialog.jsx";
import { MessageMenu } from "./MessageMenu.jsx";
import { MessageMenuButton } from "./MessageMenu.jsx";
import { quoteDraft } from "../../composer/quote-draft.js";
export function MessageActions({ message, actions }) {
  const [feedback, setFeedbackText] = useFeedback();
  // Overlays (feedback tooltip, menu, rerun dialog) mount on first use only: most messages are never touched.
  const [mounted, setMounted] = useState({ feedback: false, menu: false, rerun: false });
  const mount = (overlay) => setMounted((current) => (current[overlay] ? current : { ...current, [overlay]: true }));
  const setFeedback = (text) => { mount("feedback"); setFeedbackText(text); };
  const { busy, nativePending, hostState, connection } = useContext(PresentationContext);
  const [forking, setForking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [rerun, setRerun] = useState(null);
  const custom = message?.metadata?.custom || {};
  const openRerun = (mode) => { mount("rerun"); setRerun({ mode, canFork: Boolean(custom.forkBeforeEntryId) }); };
  const reply = message.role === "assistant" && !custom.nativeFeedback;
  const entryId = typeof custom.forkEntryId === "string" ? custom.forkEntryId : "";
  const forkDisabled = forking || nativePending || busy || !entryId;
  // Rerun/edit moves this session or forks it, so it needs an idle live runtime and a persisted, text-only message.
  // A sleeping session wakes on rerun, like on a new message.
  const liveIdle = ["idle", "sleeping"].includes(hostState) && connection === "connected" && !nativePending;
  const rerunnable = message.role === "user" && !custom.peerMessage && typeof custom.entryId === "string" && typeof custom.rerunText === "string"
    && !(Array.isArray(custom.attachments) && custom.attachments.length) && !(Array.isArray(custom.references) && custom.references.length);
  const rerunTitle = (mode) => liveIdle ? RERUN_LABELS[mode]
    : ["closed", "closing", "unavailable"].includes(hostState) ? `${RERUN_LABELS[mode]}：只读历史不能重来`
      : `${RERUN_LABELS[mode]}：当前回复完成后可用`;
  const fork = async () => {
    if (forkDisabled) return;
    setForking(true);
    try {
      if (!await actions.forkMessage(message)) setFeedback("新会话创建失败。");
    } finally { setForking(false); }
  };
  const retry = async () => {
    if (!liveIdle || retrying) return;
    setRetrying(true);
    try {
      if (!await actions.rerunMessage(message, { mode: "retry", destination: "here" })) setFeedback("无法回退到这条消息之前。");
    } finally { setRetrying(false); }
  };
  const confirmRerun = async (destination) => {
    const request = rerun;
    setRerun(null);
    if (!request || !await actions.rerunMessage(message, { mode: request.mode, destination })) setFeedback(destination === "new" ? "新会话创建失败。" : "无法回退到这条消息之前。");
  };
  const composerText = useAuiState((value) => value.composer.text);
  const text = typeof custom.copyText === "string" ? custom.copyText : contentText((message?.content || []).filter((part) => part?.type === "text"));
  const quote = () => {
    if (!text) return;
    actions.setDraft(quoteDraft(safeText(composerText), text));
    setFeedback("已加入引用");
  };
  const copy = async () => setFeedback(await copyLiteral(text) ? "已复制" : "复制失败，请手动复制");
  if (!text.trim()) return null;

  return (
    <Group className="pi-message-actions" gap={2} wrap="nowrap">
      {mounted.feedback ? <Tooltip opened={Boolean(feedback)} label={<span data-copy-feedback="message" role="status" aria-live="polite">{feedback}</span>} position="top-end" withinPortal={false} color={feedback.includes("失败") || feedback.includes("没能") ? "red" : undefined}><span className="pi-message-feedback-anchor" /></Tooltip> : null}
      <ActionIcon className="pi-message-copy" data-action="copy-message" variant="subtle" size="sm" onClick={() => void copy()} disabled={!text} aria-label="复制消息全文" title="复制消息全文"><IconCopy size={15} /></ActionIcon>
      {reply ? <ActionIcon className="pi-message-fork" data-action="fork-message" variant="subtle" size="sm" onClick={() => void fork()} disabled={forkDisabled} loading={forking} aria-label="在新会话中继续" title={busy ? "当前回复完成后可用" : !entryId ? "回复保存后可用" : "在新会话中从这里继续"}><IconGitFork size={15} /></ActionIcon> : null}
      {rerunnable ? <>
        <ActionIcon className="pi-message-retry" data-action="retry-message" variant="subtle" size="sm" onClick={() => void retry()} disabled={!liveIdle || retrying} loading={retrying} aria-label="退回并重发" title={rerunTitle("retry")}><IconRefresh size={15} /></ActionIcon>
        <ActionIcon className="pi-message-edit" data-action="edit-message" variant="subtle" size="sm" onClick={() => openRerun("edit")} disabled={!liveIdle} aria-label="改了重发" title={rerunTitle("edit")}><IconPencil size={15} /></ActionIcon>
      </> : null}
      {mounted.menu ? <MessageMenu text={text} onQuote={quote} /> : <MessageMenuButton onClick={() => mount("menu")} />}
      {mounted.rerun ? <RerunDialog request={rerun} onClose={() => setRerun(null)} onConfirm={(destination) => void confirmRerun(destination)} /> : null}
    </Group>
  );
}

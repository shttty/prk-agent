import { memo, useState } from "react";
import { Tooltip } from "@mantine/core";
import { Group } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { useAuiState } from "@assistant-ui/react";
import { contentText } from "../../conversation/content-text.ts";
import { copyLiteral } from "../../clipboard/copy-literal.ts";
import { safeText } from "../../../workbench/payloads/safe-text.js";
import type { MessageCustom, MessagePart } from "../../conversation/conversation-types.ts";
import type { ChatActions } from "../../thread/chat-actions-types.ts";
import { ForkMessageButton } from "./ForkMessageButton.tsx";
import { RerunMessageButtons } from "./RerunMessageButtons.tsx";
import { useFeedback } from "./use-feedback.ts";
import { MessageMenu } from "./MessageMenu.tsx";
import { MessageMenuButton } from "./MessageMenuButton.tsx";
import { quoteDraft } from "../../composer/quote-draft.ts";
type MessageActionsProps = { role: string; custom: MessageCustom; content: readonly MessagePart[]; actions: ChatActions };

export const MessageActions = memo(function MessageActions({ role, custom, content, actions }: MessageActionsProps) {
  const [feedback, setFeedbackText] = useFeedback();
  // Overlays (feedback tooltip, menu) mount on first use only: most messages are never touched.
  const [mounted, setMounted] = useState({ feedback: false, menu: false });
  const mount = (overlay: "feedback" | "menu") => setMounted((current) => (current[overlay] ? current : { ...current, [overlay]: true }));
  const setFeedback = (text: string) => { mount("feedback"); setFeedbackText(text); };
  const message = { role, metadata: { custom } };
  const reply = role === "assistant" && !custom.nativeFeedback;
  const rerunnable = role === "user" && !custom.peerMessage && typeof custom.entryId === "string" && typeof custom.rerunText === "string"
    && !(Array.isArray(custom.attachments) && custom.attachments.length) && !(Array.isArray(custom.references) && custom.references.length);
  const composerText = useAuiState((value) => value.composer.text);
  const text = typeof custom.copyText === "string" ? custom.copyText : contentText(content.filter((part) => part.type === "text"));
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
      <ActionIcon data-action="copy-message" variant="subtle" size="sm" onClick={() => void copy()} disabled={!text} aria-label="复制消息全文" title="复制消息全文"><IconCopy size={15} /></ActionIcon>
      {reply ? <ForkMessageButton message={message} actions={actions} onError={setFeedback} /> : null}
      {rerunnable ? <RerunMessageButtons message={message} actions={actions} onError={setFeedback} /> : null}
      {mounted.menu ? <MessageMenu text={text} onQuote={quote} /> : <MessageMenuButton onClick={() => mount("menu")} />}
    </Group>
  );
});

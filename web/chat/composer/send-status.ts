import type { LocalMessage } from "../thread/chat-state-types.ts";

// The line under the composer: what happened to the last send (and how many stopped inputs came back to the composer).
type SendStatusInput = { submitting: boolean; sleeping: boolean; localMessages: Map<string, LocalMessage>; reconnecting: boolean; restoredDraft: { count?: number; reason?: string } | null };

export function sendStatusOf({ submitting, sleeping, localMessages, reconnecting, restoredDraft }: SendStatusInput) {
  const pendingInputs = [...localMessages.values()];
  const sendingInput = pendingInputs.some((entry) => entry.status === "sending");
  const unknownInputs = pendingInputs.filter((entry) => entry.status === "unknown");
  const unknownInput = unknownInputs.length > 0;
  // A send only an earlier Gateway process could have taken: no record can confirm it, and resending may duplicate it.
  const resendable = unknownInputs.some((entry) => !entry.unconfirmable);
  const unknownStatus = resendable ? "发送结果未知，连接恢复后自动确认。" : "Gateway 重启过，无法确认是否已送达；请看对话后再决定。";
  const sendStatus = !(submitting || sendingInput || unknownInput) ? ""
    : reconnecting ? "正在重新连接…" : submitting && sleeping ? "正在唤醒会话并发送…" : submitting || sendingInput ? "正在发送…" : unknownStatus;
  const sendStatusState = !sendStatus ? undefined : reconnecting ? "reconnecting" : submitting && sleeping ? "waking" : submitting || sendingInput ? "sending" : "unknown";
  // Stop returns queued-but-unread inputs to the composer (like the Pi TUI); say so once instead of silently refilling it.
  const restoredCount = Number(restoredDraft?.count) || 0;
  const restoredReason = restoredDraft?.reason === "undelivered" ? "undelivered" : "stopped";
  const restoreStatus = restoredCount <= 0 ? "" : restoredReason === "undelivered" ? "消息未送达，已放回输入框。" : `已停止，${restoredCount} 条未处理的消息已移回输入框。`;
  return { unknownInput, resendable, sendStatus, sendStatusState, restoredCount, restoredReason, restoreStatus };
}

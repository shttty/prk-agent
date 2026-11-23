// The line under the composer: what happened to the last send (and how many stopped inputs came back to the composer).
export function sendStatusOf({ submitting, sleeping, localMessages, reconnecting, restoredDraft }) {
  const pendingInputs = [...localMessages.values()];
  const sendingInput = pendingInputs.some((entry) => entry.status === "sending");
  const unknownInput = pendingInputs.some((entry) => entry.status === "unknown");
  const sendStatus = !(submitting || sendingInput || unknownInput) ? ""
    : reconnecting ? "正在重新连接…" : submitting && sleeping ? "正在唤醒会话并发送…" : submitting || sendingInput ? "正在发送…" : "发送结果未知，请重新连接确认。";
  const sendStatusState = !sendStatus ? undefined : reconnecting ? "reconnecting" : submitting && sleeping ? "waking" : submitting || sendingInput ? "sending" : "unknown";
  // Stop returns queued-but-unread inputs to the composer (like the Pi TUI); say so once instead of silently refilling it.
  const restoredCount = Number(restoredDraft?.count) || 0;
  const restoreStatus = restoredCount > 0 ? `已停止，${restoredCount} 条未处理的消息已移回输入框。` : "";
  return { unknownInput, sendStatus, sendStatusState, restoredCount, restoreStatus };
}

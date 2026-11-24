import { useState } from "react";
import { ActionIcon } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { IconRefresh } from "@tabler/icons-react";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
import { RERUN_LABELS, RerunDialog } from "./RerunDialog.jsx";

export function RerunMessageButtons({ message, actions, onError }) {
  const hostState = useWorkbench((state) => state.session.snapshot?.state);
  const connected = useWorkbench((state) => state.session.connection === "connected");
  const nativePending = useWorkbench((state) => state.session.pending.has("nativeActionPending"));
  const [retrying, setRetrying] = useState(false);
  const [rerun, setRerun] = useState(null);
  const [dialogMounted, setDialogMounted] = useState(false);
  // Rerun moves this session or forks it. A sleeping session wakes on rerun, as on a new message.
  const liveIdle = ["idle", "sleeping"].includes(hostState) && connected && !nativePending;
  const rerunTitle = (mode) => liveIdle ? RERUN_LABELS[mode]
    : ["closed", "closing", "unavailable"].includes(hostState) ? `${RERUN_LABELS[mode]}：只读历史不能重来`
      : `${RERUN_LABELS[mode]}：当前回复完成后可用`;
  const retry = async () => {
    if (!liveIdle || retrying) return;
    setRetrying(true);
    try {
      if (!await actions.rerunMessage(message, { mode: "retry", destination: "here" })) onError("无法回退到这条消息之前。");
    } finally { setRetrying(false); }
  };
  const confirm = async (destination) => {
    if (!rerun) return;
    setRerun(null);
    if (!await actions.rerunMessage(message, { mode: rerun.mode, destination })) onError(destination === "new" ? "新会话创建失败。" : "无法回退到这条消息之前。");
  };
  return <>
    <ActionIcon className="pi-message-retry" data-action="retry-message" variant="subtle" size="sm" onClick={() => void retry()} disabled={!liveIdle || retrying} loading={retrying} aria-label="退回并重发" title={rerunTitle("retry")}><IconRefresh size={15} /></ActionIcon>
    <ActionIcon className="pi-message-edit" data-action="edit-message" variant="subtle" size="sm" onClick={() => { setDialogMounted(true); setRerun({ mode: "edit", canFork: Boolean(message.metadata?.custom?.forkBeforeEntryId) }); }} disabled={!liveIdle} aria-label="改了重发" title={rerunTitle("edit")}><IconPencil size={15} /></ActionIcon>
    {dialogMounted ? <RerunDialog request={rerun} onClose={() => setRerun(null)} onConfirm={(destination) => void confirm(destination)} /> : null}
  </>;
}

import "./send/send.css";
import { memo } from "react";
import { Text } from "@mantine/core";
import { Button } from "@mantine/core";
import { IconArrowBackUp } from "@tabler/icons-react";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import { useChatState } from "../thread/use-chat-state.ts";
const QUEUE_GROUPS = [["steering", "补充当前任务"], ["followUp", "排到下一轮"]] as const;
export const PendingQueue = memo(function PendingQueue({ actions }: { actions: ChatActions }) {
  const queuedMessages = useChatState((state) => state.session.snapshot?.queuedMessages);
  const receiving = useChatState((state) => state.session.snapshot?.receivingUserText);
  const disabled = useChatState((state) => state.session.connection !== "connected" || state.session.pending.has("nativeActionPending"));
  const queuedGroups = QUEUE_GROUPS.map(([key, label]) => ({ key, label, texts: queuedMessages?.[key] ?? [] }));
  const hasQueuedMessages = queuedGroups.some((group) => group.texts.length > 0);
  return (
    hasQueuedMessages || typeof receiving === "string" ? <section className="pi-pending-queue" aria-label="已提交的消息">
              <div className="pi-pending-queue-list">
                {typeof receiving === "string" ? <div data-stage="receiving"><Text className="pi-pending-queue-label" size="xs">已接收 · 正在加入对话</Text><ol><li>{receiving || "图片消息"}</li></ol></div> : null}
                {queuedGroups.filter((group) => group.texts.length).map((group) => <div key={group.key}><Text className="pi-pending-queue-label" size="xs">{group.label} · {group.texts.length}</Text><ol>{group.texts.map((text, index) => <li key={index}>{text}</li>)}</ol></div>)}
              </div>
              {hasQueuedMessages ? <Button id="restore-queued-messages" type="button" size="compact-xs" variant="subtle" color="gray" leftSection={<IconArrowBackUp size={14} />} disabled={disabled} onClick={() => void actions.executeNativeAction("dequeue", {}, { transcript: false })}>取回全部待发送文本</Button> : null}
            </section> : null
  );
});

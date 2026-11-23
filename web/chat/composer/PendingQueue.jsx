import "./send/send.css";
import { memo } from "react";
import { Text } from "@mantine/core";
import { Button } from "@mantine/core";
import { IconArrowBackUp } from "@tabler/icons-react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
const QUEUE_GROUPS = [["steering", "补充当前任务"], ["followUp", "排到下一轮"]];
export const PendingQueue = memo(function PendingQueue({ actions }) {
  const queuedMessages = useWorkbench((state) => state.session.snapshot?.queuedMessages);
  const disabled = useWorkbench((state) => state.session.connection !== "connected" || state.session.pending.has("nativeActionPending"));
  const queuedGroups = QUEUE_GROUPS.map(([key, label]) => ({ key, label, texts: Array.isArray(queuedMessages?.[key]) ? queuedMessages[key] : [] }));
  const hasQueuedMessages = queuedGroups.some((group) => group.texts.length > 0);
  return (
    hasQueuedMessages ? <section className="pi-pending-queue" aria-label="待发送文本">
              <div className="pi-pending-queue-list">
                {queuedGroups.filter((group) => group.texts.length).map((group) => <div key={group.key} className="pi-pending-queue-group"><Text className="pi-pending-queue-label" size="xs">{group.label} · {group.texts.length}</Text><ol>{group.texts.map((text, index) => <li key={index}>{text}</li>)}</ol></div>)}
              </div>
              <Button id="restore-queued-messages" type="button" size="compact-xs" variant="subtle" color="gray" leftSection={<IconArrowBackUp size={14} />} disabled={disabled} onClick={() => void actions.executeNativeAction("dequeue", {}, { transcript: false })}>取回全部待发送文本</Button>
            </section> : null
  );
});

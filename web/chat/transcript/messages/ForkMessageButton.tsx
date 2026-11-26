import { useState } from "react";
import { ActionIcon } from "@mantine/core";
import type { MessageCustom } from "../../conversation/conversation-types.ts";
import type { ChatActions } from "../../thread/chat-actions-types.ts";
import { IconGitFork } from "@tabler/icons-react";

type ForkMessageButtonProps = { message: { role: string; metadata: { custom: MessageCustom } }; actions: ChatActions; onError: (text: string) => void };

export function ForkMessageButton({ message, actions, onError }: ForkMessageButtonProps) {
  const [forking, setForking] = useState(false);
  const entryId = message.metadata.custom.forkEntryId;
  const saved = typeof entryId === "string" && Boolean(entryId);
  const disabled = forking || !saved;
  const fork = async () => {
    if (disabled) return;
    setForking(true);
    try {
      if (!await actions.forkMessage(message)) onError("新会话创建失败。");
    } finally { setForking(false); }
  };
  return <ActionIcon data-action="fork-message" variant="subtle" size="sm" onClick={() => void fork()} disabled={disabled} loading={forking} aria-label="在新会话中继续" title={forking ? "正在创建新会话…" : !saved ? "回复保存后可用" : "在新会话中从这里继续"}><IconGitFork size={15} /></ActionIcon>;
}

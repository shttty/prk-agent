import "./send/send.css";
import { memo } from "react";
import { Button, Group, Text } from "@mantine/core";
import { useChatState } from "../thread/use-chat-state.ts";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import { sendStatusOf } from "./send-status.ts";
export const SendStatus = memo(function SendStatus({ actions }: { actions: ChatActions }) {
  const submitting = useChatState((state) => state.session.pending.has("sending"));
  const sleeping = useChatState((state) => (state.session.snapshot?.state || (state.selectedSessionId ? state.sessions.get(state.selectedSessionId)?.state : undefined)) === "sleeping");
  const localMessages = useChatState((state) => state.session.localMessages);
  const reconnecting = useChatState((state) => state.session.pending.has("reconnecting"));
  const restoredDraft = useChatState((state) => state.session.restoredDraft);
  const { sendStatus, unknownInput, resendable, sendStatusState, restoreStatus, restoredCount, restoredReason } = sendStatusOf({ submitting, sleeping, localMessages, reconnecting, restoredDraft });
  const unknownActions = unknownInput && !submitting;
  return <>
            <Group className={`pi-send-status${unknownInput ? " is-unknown" : ""}`} data-state={sendStatusState} gap={6} wrap="nowrap">
              <Text size="xs" role="status">{sendStatus}</Text>
              {unknownActions && resendable ? <Button type="button" size="compact-xs" variant="subtle" color="gray" data-action="resend-unknown" onClick={() => void actions.resendUnknownSends()}>重新发送</Button> : null}
              {unknownActions ? <Button type="button" size="compact-xs" variant="subtle" color="gray" data-action="restore-unknown" onClick={() => actions.returnUnknownSends()}>放回草稿</Button> : null}
            </Group>
            {restoreStatus ? <Text id="restored-draft-status" data-count={restoredCount} data-reason={restoredReason} className="pi-send-status is-restored" size="xs" role="status">{restoreStatus}</Text> : null}
  </>;
});

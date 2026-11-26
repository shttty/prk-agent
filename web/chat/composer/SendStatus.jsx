import "./send/send.css";
import { memo } from "react";
import { Button, Group, Text } from "@mantine/core";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { sendStatusOf } from "./send-status.js";
export const SendStatus = memo(function SendStatus({ actions }) {
  const submitting = useWorkbench((state) => state.session.pending.has("sending"));
  const sleeping = useWorkbench((state) => (state.session.snapshot?.state || state.sessions.get(state.selectedSessionId)?.state) === "sleeping");
  const localMessages = useWorkbench((state) => state.session.localMessages);
  const reconnecting = useWorkbench((state) => state.session.pending.has("reconnecting"));
  const restoredDraft = useWorkbench((state) => state.session.restoredDraft);
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

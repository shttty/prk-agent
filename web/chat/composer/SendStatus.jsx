import "./send/send.css";
import { memo } from "react";
import { Text } from "@mantine/core";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { sendStatusOf } from "./send-status.js";
export const SendStatus = memo(function SendStatus() {
  const submitting = useWorkbench((state) => state.session.pending.has("sending"));
  const sleeping = useWorkbench((state) => (state.session.snapshot?.state || state.sessions.get(state.selectedSessionId)?.state) === "sleeping");
  const localMessages = useWorkbench((state) => state.session.localMessages);
  const reconnecting = useWorkbench((state) => state.session.pending.has("reconnecting"));
  const restoredDraft = useWorkbench((state) => state.session.restoredDraft);
  const { sendStatus, unknownInput, sendStatusState, restoreStatus, restoredCount } = sendStatusOf({ submitting, sleeping, localMessages, reconnecting, restoredDraft });
  return <>
            <Text className={`pi-send-status${unknownInput ? " is-unknown" : ""}`} data-state={sendStatusState} size="xs" role="status">{sendStatus}</Text>
            {restoreStatus ? <Text id="restored-draft-status" data-count={restoredCount} className="pi-send-status is-restored" size="xs" role="status">{restoreStatus}</Text> : null}
  </>;
});

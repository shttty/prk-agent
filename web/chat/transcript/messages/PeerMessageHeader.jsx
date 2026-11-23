import "./peer-message.css";
import { useContext } from "react";
import { Group } from "@mantine/core";
import { UnstyledButton } from "@mantine/core";
import { IconMessageForward } from "@tabler/icons-react";
import { PresentationContext } from "../presentation-context.js";
import { shortSessionId } from "../tool-calls/short-session-id.js";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
/** Sender line of a Gateway-stamped agent message; the name opens the sender's session when it still exists. */
export function PeerMessageHeader({ peer }) {
  const context = useContext(PresentationContext);
  const known = useWorkbench((state) => state.sessions.get(peer.sender));
  const name = known?.label || peer.label || shortSessionId(peer.sender);
  const kind = peer.label ? "会话" : "Agent";
  const open = known && context?.actions?.selectSession ? () => { void context.actions.selectSession(peer.sender); } : null;
  return (
    <Group className="pi-peer-header" gap={6} wrap="nowrap">
      <IconMessageForward size={14} aria-hidden="true" />
      <span>来自{kind}</span>
      {open
        ? <UnstyledButton className="pi-peer-sender" onClick={open} title={`打开「${name}」`}>{name}</UnstyledButton>
        : <span className="pi-peer-sender">{name}</span>}
      {peer.replyTo ? <span className="pi-peer-reply">回复</span> : null}
    </Group>
  );
}

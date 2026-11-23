import { Modal } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { unreadableIdentity } from "./unreadable-identity.js";
import "./unreadable.css";
/** Why one session cannot be read. Shows only the diagnosis (and the session file); it never opens the session and invents no identity. */
export function UnreadableReason({ issue, onClose }) {
  return <Modal opened={Boolean(issue)} onClose={onClose} title="无法读取会话" centered size={460} closeButtonProps={{ id: "close-unreadable-session-reason", "aria-label": "关闭" }}>
    {issue && <Stack id="unreadable-session-reason" data-session-file={issue.sessionFile} data-session-id={issue.sessionId || undefined} gap="xs">
      {unreadableIdentity(issue) && <Text fw={600} className="unreadable-reason-identity">{unreadableIdentity(issue)}</Text>}
      <Text size="sm" className="unreadable-reason-text">{issue.reason}</Text>
      {issue.sessionFile && <Text size="xs" c="dimmed" className="unreadable-reason-file">{issue.sessionFile}</Text>}
    </Stack>}
  </Modal>;
}

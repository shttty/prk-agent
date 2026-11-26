import { Box, Flex, Stack, UnstyledButton } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { sessionTargetLabel } from "../sidebar/labels/session-target-label.ts";
import type { TargetMap, UnreadableItem } from "../sidebar/sidebar-types.ts";
import "../sidebar/session-row.css";
import "./unreadable.css";

type UnreadableRowProps = { item: UnreadableItem; targets: TargetMap; onOpen: (key: string) => void };

/** Sidebar row of a session whose data cannot be read: same place as a session row, but it only opens the reason (no chat, no menu). */
export function UnreadableRow({ item, targets, onOpen }: UnreadableRowProps) {
  const issue = item.unreadable;
  return (
    <div className="management-tree-node">
      {/* No "…" menu, so no room is kept for it: the row ends 12px after the state. */}
      <Flex align="center" ps="var(--tree-row-inset)" pe={12} data-status="unreadable" data-session-file={issue.sessionFile} data-session-id={issue.sessionId || undefined} className="management-session-row is-unreadable">
        <Box w="var(--tree-caret-width)" flex="none" />
        <UnstyledButton className="management-session-select" flex={1} miw={0} aria-haspopup="dialog" title={issue.reason} onClick={() => onOpen(issue.key)}>
          <Flex align="center" gap="var(--tree-label-gap)">
            <Flex w="var(--tree-marker-width)" justify="center" flex="none"><IconAlertTriangle className="management-unreadable-mark" data-unreadable-warning="true" size={14} stroke={2} aria-hidden="true" /></Flex>
            <Stack component="span" gap={2} flex={1} miw={0} className="management-session-copy">
              <strong>{item.label}</strong>
              {issue.location === "active" && <span>{sessionTargetLabel(item, targets)}</span>}
            </Stack>
            <Flex component="span" align="center" gap={6} className="management-session-aside"><span className="management-session-state" data-state="unreadable">无法读取</span></Flex>
          </Flex>
        </UnstyledButton>
      </Flex>
    </div>
  );
}

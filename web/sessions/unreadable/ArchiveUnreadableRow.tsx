import { Badge } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { sessionTargetLabel } from "../sidebar/labels/session-target-label.ts";
import type { TargetMap, UnreadableItem } from "../sidebar/sidebar-types.ts";
import "../dialogs/dialogs.css";
import "./unreadable.css";
/** Archive-list row of an archived session whose data cannot be read: it only opens the reason. */
type ArchiveUnreadableRowProps = { item: UnreadableItem; targets: TargetMap; onOpen: (key: string) => void };

export function ArchiveUnreadableRow({ item, targets, onOpen }: ArchiveUnreadableRowProps) {
  const issue = item.unreadable;
  return (
    <div className="management-archive-session" data-status="unreadable" data-session-file={issue.sessionFile} data-session-id={issue.sessionId || undefined} data-archive-target={issue.target}>
      <button type="button" className="management-affected-node management-unreadable-archive" aria-haspopup="dialog" title={issue.reason} onClick={() => onOpen(issue.key)}>
        <IconAlertTriangle className="management-unreadable-mark" data-unreadable-warning="true" size={14} stroke={2} aria-hidden="true" />
        <strong>{item.label}</strong>
        <Badge component="span" variant="light" color="yellow" size="sm" tt="none" className="management-affected-warn" data-state="unreadable">无法读取</Badge>
        <span className="management-archive-location">{sessionTargetLabel(item, targets)}</span>
      </button>
    </div>
  );
}

import { IconAlertTriangle } from "@tabler/icons-react";
import { sessionTargetLabel } from "../sidebar/labels/session-target-label.js";
import "../sidebar/session-row.css";
import "./unreadable.css";
/** Sidebar row of a session whose data cannot be read: same place as a session row, but it only opens the reason (no chat, no menu). */
export function UnreadableRow({ item, targets, onOpen }) {
  const issue = item.unreadable;
  return (
    <div className="management-tree-node">
      <div data-status="unreadable" data-session-file={issue.sessionFile} data-session-id={issue.sessionId || undefined} className="management-session-row is-unreadable">
        <button type="button" className="management-session-select" aria-haspopup="dialog" title={issue.reason} onClick={() => onOpen(issue.key)}>
          <IconAlertTriangle className="management-unreadable-mark" data-unreadable-warning="true" size={14} stroke={2} aria-hidden="true" />
          <span className="management-session-copy">
            <strong>{item.label}</strong>
            {issue.location === "active" && <span>{sessionTargetLabel(item, targets)}</span>}
          </span>
          <span className="management-session-aside"><span className="management-session-state" data-state="unreadable">无法读取</span></span>
        </button>
      </div>
    </div>
  );
}

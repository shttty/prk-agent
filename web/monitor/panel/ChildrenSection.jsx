import StatusDot from "../../design-system/status-dot/StatusDot.jsx";
import { childSessions } from "../readings/child-sessions.js";
import { childrenSummary } from "../readings/children-summary.js";
import { RunTime } from "../../sessions/children/RunTime.jsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { FoldSection } from "./FoldSection.jsx";

/** Child sessions this one manages: name, machine, state ("已交付" once the result is handed in) and, when the row
 * carries `startedAt`, how long it has run (total once delivered, with `finishedAt`). A click selects the child.
 * Folded, the heading still counts them by state. */
export function ChildrenSection({ sessionRow, now, onSelect }) {
  const sessions = useWorkbench((state) => state.sessions);
  const targets = useWorkbench((state) => state.targets);
  const children = childSessions(sessions, sessionRow.sessionId, targets);
  if (!children.length) return null;
  const groups = childrenSummary(children);
  const count = (key) => groups.find((group) => group.key === key)?.count ?? 0;
  const summary = groups.map(({ key, label, tone, count }) => <span key={key} className="pi-monitor-summary-part" data-state={key} data-count={count}><StatusDot tone={tone} size={6} />{count} {label}</span>);
  return <FoldSection name="children" title="子会话" summary={summary} id="monitor-children" data-count={children.length} data-running={count("running")} data-delivered={count("delivered")} aria-label="子会话">
    <ul className="pi-monitor-children">
      {children.map((child) => <li key={child.sessionId}>
        <button type="button" data-action="select-child" data-child={child.sessionId} data-state={child.state.key} onClick={() => onSelect?.(child.sessionId)}>
          <StatusDot tone={child.state.tone} size={6} />
          <span className="pi-monitor-path">{child.label}</span>
          <span className="pi-monitor-counts">{child.place}</span>
          <span className="pi-monitor-child-state">{child.state.label}<RunTime startedAt={child.startedAt} finishedAt={child.finishedAt} delivered={child.state.key === "delivered"} now={now} /></span>
        </button>
      </li>)}
    </ul>
  </FoldSection>;
}

import StatusDot from "../../design-system/status-dot/StatusDot.jsx";
import { childSessions } from "../readings/child-sessions.js";
import { RunTime } from "../../sessions/children/RunTime.jsx";
import { IN_FLIGHT } from "../../sessions/children/in-flight.js";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";

/** Child sessions this one manages: name, machine, state ("已交付" once the result is handed in) and, when the row
 * carries `startedAt`, how long it has run (total once delivered, with `finishedAt`). A click selects the child. */
export function ChildrenSection({ sessionRow, now, onSelect }) {
  const sessions = useWorkbench((state) => state.sessions);
  const targets = useWorkbench((state) => state.targets);
  const children = childSessions(sessions, sessionRow.sessionId, targets);
  if (!children.length) return null;
  const running = children.filter((child) => IN_FLIGHT.has(child.state.key)).length;
  const delivered = children.filter((child) => child.state.key === "delivered").length;
  return <section className="pi-monitor-section" id="monitor-children" data-count={children.length} data-running={running} data-delivered={delivered} aria-label="子会话">
    <h3>子会话 <span className="pi-monitor-summary">{running} 个运行中 · {delivered} 个已交付</span></h3>
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
  </section>;
}

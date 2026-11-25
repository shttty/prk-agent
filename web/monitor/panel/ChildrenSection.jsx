import StatusDot from "../../design-system/status-dot/StatusDot.jsx";
import { RunTime } from "../../sessions/children/RunTime.jsx";

export function ChildrenSection({ children, now, onSelect }) {
  if (!children.length) return <div className="pi-monitor-section pi-monitor-empty">没有子会话。</div>;
  return <section className="pi-monitor-section" id="monitor-children" data-count={children.length} aria-label="子会话">
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

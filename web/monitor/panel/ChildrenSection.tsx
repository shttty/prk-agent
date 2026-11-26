import StatusDot from "../../design-system/status-dot/StatusDot.tsx";
import { RunTime } from "../../sessions/children/RunTime.tsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import type { SessionRows } from "../../sessions/session-row-types.ts";
import { childSessions } from "../readings/child-sessions.ts";
import { childrenSummary } from "../readings/children-summary.ts";
import { FoldSection } from "./FoldSection.tsx";
import type { WorkbenchReads } from "../../sessions/workbench-reads-types.ts";

type ChildrenSectionProps = { sessionId: string; now: number; onSelect?: (sessionId: string) => void };

/** Child sessions this one manages: name, machine, state ("已交付" once the result is handed in) and, when the row
 * carries `startedAt`, how long it has run (total once delivered, with `finishedAt`). A click selects the child.
 * The heading counts them by state in one muted line, folded or open. */
export function ChildrenSection({ sessionId, now, onSelect }: ChildrenSectionProps) {
  const sessions: SessionRows = useWorkbench((state: WorkbenchReads) => state.sessions);
  const targets: PublicExecutionTarget[] = useWorkbench((state: WorkbenchReads) => state.targets);
  const children = childSessions(sessions, sessionId, targets);
  if (!children.length) return null;
  const { counts, text } = childrenSummary(children);
  return <FoldSection name="children" title="子会话" summary={text} id="monitor-children" data-count={children.length} data-running={counts.running ?? 0} data-delivered={counts.delivered ?? 0} aria-label="子会话">
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

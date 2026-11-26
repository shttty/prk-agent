import type { SessionListRow } from "../../../tool-text/session-list-rows.ts";
import { useWorkbench } from "../../../../workbench/subscription/use-workbench.ts";
import { RoleBadges } from "../../../../sessions/roles/RoleBadges.jsx";
import { label as stateLabel } from "../../../../sessions/details/status-label.js";

/** Reachable sessions with state, control roles and current parent; legacy history may also carry project/creator. */
export function SessionListResult({ rows }: { rows: SessionListRow[] }) {
  const sessions: Map<string, { label?: string; projectId?: string; projectName?: string }> | undefined = useWorkbench((state: { sessions?: Map<string, { label?: string; projectId?: string; projectName?: string }> }) => state.sessions);
  const labelOf = (id: string) => rows.find((row) => row.sessionId === id)?.sessionName
    || sessions?.get(id)?.label || id;
  const projectOf = (id: string) => [...(sessions?.values() ?? [])].find((sessionRow) => sessionRow.projectId === id && sessionRow.projectName)?.projectName || id;
  if (!rows.length) return <div className="pi-session-list is-empty" data-count={0}>无可联系的会话</div>;
  return <ul className="pi-session-list" data-count={rows.length}>
    {rows.map((row) => <li key={row.sessionId} className="pi-session-entry" data-session-id={row.sessionId} data-state={row.state}
      data-owner={row.parentSessionId || undefined} data-created-by={row.createdBy || undefined} data-pending-owner={row.pendingParentSessionId || undefined} data-project={row.projectId || undefined}>
      <div className="pi-session-entry-head">
        <strong className="pi-session-entry-label">{row.sessionName}</strong>
        <RoleBadges root={row.root} supervisor={row.supervisor} />
        <span className="pi-session-entry-state">{stateLabel(row.state)}</span>
        {row.projectId ? <span className="pi-session-entry-project" data-field="project">{projectOf(row.projectId)}</span> : null}
      </div>
      <div className="pi-session-entry-relations">
        <span data-field="owner">父会话 {row.parentSessionId ? labelOf(row.parentSessionId) : "无"}</span>
        {row.createdBy && row.createdBy !== row.parentSessionId ? <span data-field="created-by">创建者 {labelOf(row.createdBy)}</span> : null}
        {row.pendingParentSessionId ? <span data-field="pending-owner" className="is-pending">待 {labelOf(row.pendingParentSessionId)} 接收</span> : null}
      </div>
    </li>)}
  </ul>;
}

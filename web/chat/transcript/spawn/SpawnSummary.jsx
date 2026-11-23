import "./spawn.css";
import { useContext } from "react";
import StatusDot from "../../../design-system/status-dot/StatusDot.jsx";
import { PresentationContext } from "../presentation-context.js";
import { TurnContext } from "../turns/turn-context.js";
import { spawnedChildren } from "./spawned-children.js";
import { SPAWN_TOOL } from "./spawned-children.js";
import { useTicker } from "../tool-calls/use-ticker.js";
import { RunTime } from "../../../sessions/children/RunTime.jsx";
import { IN_FLIGHT } from "../../../sessions/children/in-flight.js";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";

/** One card for every child session a turn spawned: "N 个运行中 · M 个已交付", a row per child (name, machine, state,
 * run time when the row has `startedAt`) and, once handed in, its result summary quoted with who and where. All live
 * from the workbench rows. */
export function SpawnSummary() {
  const message = useContext(TurnContext);
  const context = useContext(PresentationContext);
  const parts = Array.isArray(message?.content) ? message.content : [];
  // Only a turn that spawned children reads the session list (most turns render nothing here).
  const spawns = parts.some((part) => part?.type === "tool-call" && part.toolName === SPAWN_TOOL);
  const sessions = useWorkbench((state) => (spawns ? state.sessions : null));
  const targets = useWorkbench((state) => (spawns ? state.targets : null));
  const { total, rows } = spawnedChildren(parts, sessions, targets || []);
  // Ticks only while some child is still timing (has a start, no result yet).
  const now = useTicker(rows.some((row) => Number.isFinite(row.startedAt) && row.state.key !== "delivered"));
  if (!total) return null;
  const running = rows.filter((row) => IN_FLIGHT.has(row.state.key)).length;
  const delivered = rows.filter((row) => row.state.key === "delivered").length;
  return <div className="pi-spawn" data-count={total} data-running={running} data-delivered={delivered}>
    <div className="pi-spawn-head"><strong>子会话 ×{total}</strong><span>{running} 个运行中 · {delivered} 个已交付</span></div>
    {rows.map((row) => <div key={row.sessionId} className="pi-spawn-child" data-child={row.sessionId} data-state={row.state.key}>
      <button type="button" className="pi-spawn-row" data-action="select-child" onClick={() => context?.actions?.selectSession?.(row.sessionId)}>
        <StatusDot tone={row.state.tone} size={6} /><span className="pi-spawn-name">{row.label}</span><span className="pi-spawn-place">{row.place}</span><span className="pi-spawn-state">{row.state.label}<RunTime startedAt={row.startedAt} finishedAt={row.finishedAt} delivered={row.state.key === "delivered"} now={now} /></span>
      </button>
      {row.state.key === "delivered" && row.summary ? <blockquote className="pi-spawn-result"><cite>{row.label} · {row.place}</cite><p>{row.summary}</p></blockquote> : null}
    </div>)}
  </div>;
}

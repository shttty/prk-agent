import { text } from "./text.js";
import { derivationSummary } from "./labels/derivation-summary.js";
import { sessionTargetLabel } from "./labels/session-target-label.js";
import { rowState } from "./labels/row-state.js";
import { visibleOwner } from "./grouping/visible-owner.js";
import { sessionLabelById } from "./labels/session-label-by-id.js";
import { MAX_TREE_DEPTH } from "./sidebar-constants.js";
import { askingUnder } from "./grouping/asking-under.js";
import { alertsOf } from "../../monitor/readings/alerts-of.js";
import { deltaLabel } from "../../monitor/readings/delta-label.js";
import { CLOSED_STATES } from "./grouping/closed-last.js";
import { IconChevronRight } from "@tabler/icons-react";
import StatusDot from "../../design-system/status-dot/StatusDot.jsx";
import { Badge } from "@mantine/core";
import { IconMessageQuestion } from "@tabler/icons-react";
import { MonitorMarks } from "../../monitor/button/MonitorMarks.jsx";
import { Menu } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import { CLONEABLE_STATES } from "./sidebar-constants.js";
import { sessionRoles } from "../roles/session-roles.js";
import { RoleBadges } from "../roles/RoleBadges.jsx";
import "./session-row.css";
/** `rows`: the sidebar's row inputs (sessions, selectedSessionId, sessionControl and in-flight action flags). */
export function SessionRow({ sessionRow, targets, rows, onSelected, onSessionAction, projectView, tree, depth = 0, drag = null }) {
  const sessions = rows.sessions;
  const selected = sessionRow.sessionId === rows.selectedSessionId;
  const sessionLabel = text(sessionRow.label).trim() || text(sessionRow.sessionId);
  const cwd = text(sessionRow.cwd).trim();
  const derivation = derivationSummary(sessionRow, sessions);
  const location = sessionTargetLabel(sessionRow, targets);
  const closed = sessionRow.state === "closed";
  const sleeping = sessionRow.state === "sleeping";
  const unavailable = sessionRow.state === "unavailable";
  const roles = sessionRoles(rows.sessionControl, sessionRow);
  const local = targets.get(text(sessionRow.target))?.local === true;
  const temporary = sessionRow.derivation?.lifecycle === "temporary";
  const child = Boolean(sessionRow.derivation);
  const shownState = rowState(sessionRow);
  // A child session managed from another instance (or project) still reads as a child: indented, tagged, and its
  // manager named in the row's title.
  const remoteOwner = depth === 0 ? visibleOwner(sessionRow, sessions) : "";
  const remoteOwnerLabel = remoteOwner ? sessionLabelById(sessions, remoteOwner) : "";
  const children = depth < MAX_TREE_DEPTH ? tree.childrenOf.get(sessionRow.sessionId) || [] : [];
  const expanded = children.length > 0 && !tree.collapsed.has(sessionRow.sessionId);
  // An ask waits here, or in a child this folded row hides.
  const asking = sessionRow.asking === true;
  const askingBelow = !asking && children.length > 0 && !expanded && askingUnder(sessionRow.sessionId, tree.childrenOf);
  const pendingOwner = text(sessionRow.derivation?.pendingOwner);
  const draggable = Boolean(projectView && drag && !rows.projectMutating);
  const dragging = drag?.draggedSessionId === sessionRow.sessionId;
  const onDragStart = draggable ? (event) => {
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-prk-session", sessionRow.sessionId);
      event.dataTransfer.setData("text/plain", sessionRow.sessionId);
    }
    drag.onStart(sessionRow);
  } : undefined;
  const onDragEnd = draggable ? (event) => {
    event.stopPropagation();
    drag.onEnd();
  } : undefined;
  return (
    <div className={`management-tree-node${temporary ? " is-temporary" : ""}${remoteOwnerLabel ? " is-remote-child" : ""}`}>
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-session-id={sessionRow.sessionId}
      data-status={sessionRow.state}
      data-phase={sessionRow.derivation?.phase}
      data-pending-owner={pendingOwner || undefined}
      data-asking={asking ? "true" : undefined}
      data-alert={alertsOf(sessionRow).any ? "true" : undefined}
      data-delta={deltaLabel(sessionRow) ?? undefined}
      data-dragging={dragging ? "true" : undefined}
      aria-current={selected ? "true" : undefined}
      className={`management-session-row${selected ? " is-selected" : ""}${CLOSED_STATES.has(sessionRow.state) ? " is-closed" : ""}${temporary ? " is-temporary" : ""}${dragging ? " is-dragging" : ""}`}
    >
      {children.length > 0 && <button type="button" className="management-tree-toggle" aria-expanded={expanded} aria-label={`${expanded ? "折叠" : "展开"}${sessionLabel}的子会话`} onClick={() => tree.toggle(sessionRow.sessionId)}>
        <IconChevronRight size={12} stroke={2.2} aria-hidden="true" />
      </button>}
      <button type="button" className="management-session-select" onClick={() => onSelected(sessionRow.sessionId)} aria-current={selected ? "true" : undefined} title={[cwd ? `工作目录：${cwd}` : "", remoteOwnerLabel ? `由 ${remoteOwnerLabel} 管理` : "", pendingOwner ? `待 ${sessionLabelById(sessions, pendingOwner)} 接收` : "", !cwd && !remoteOwnerLabel ? derivation : ""].filter(Boolean).join("\n")}>
        <StatusDot className="management-status-dot" tone={shownState.tone} size={temporary ? 5 : 7} />
        <span className="management-session-copy">
          <span className="management-session-title">
            <strong>{sessionLabel}</strong>
            <RoleBadges {...roles} />
            {pendingOwner ? <Badge component="span" variant="light" color="gray" size="xs" tt="none" radius="sm" className="management-session-pending" data-pending-owner={pendingOwner}>待接收</Badge> : null}
          </span>
          {child ? <Badge component="span" variant="outline" color="gray" size="xs" tt="none" radius="sm" className="management-session-capability" data-kind="child">子会话</Badge> : null}
          <span>{location}</span>
        </span>
        <span className="management-session-aside">
          {(asking || askingBelow) && <IconMessageQuestion className="management-ask-mark" data-ask-mark={asking ? "self" : "below"} role="img" aria-label="有问题等待回答" size={14} stroke={2} />}
          <MonitorMarks sessionRow={sessionRow} />
          {(!projectView || sessionRow.state === "sleeping" || ["delivered", "compacting"].includes(shownState.key)) && <span className="management-session-state" data-state={shownState.key}>{shownState.label}</span>}
        </span>
      </button>
      {/* Long menu: flip to the roomier side and cap to the viewport, scrolling inside (phones). */}
      <Menu position="bottom-end" withinPortal middlewares={{ flip: { fallbackStrategy: "bestFit" }, shift: true, size: { padding: 8 } }}>
        <Menu.Target><ActionIcon className="management-session-menu" data-action="session-menu" variant="subtle" color="gray" size={30} radius="md" aria-label={`${sessionLabel}的会话设置`}><IconDots size={16} /></ActionIcon></Menu.Target>
        <Menu.Dropdown className="management-session-dropdown">
          <Menu.Label>{sessionLabel}</Menu.Label>
          <Menu.Item id="session-details" onClick={() => onSessionAction("details", sessionRow.sessionId)}>会话详情</Menu.Item>
          <Menu.Item id="session-tools" disabled={closed || unavailable} onClick={() => onSessionAction("tools", sessionRow.sessionId)}>工具</Menu.Item>
          <Menu.Item id="session-skills" disabled={closed || unavailable} onClick={() => onSessionAction("skills", sessionRow.sessionId)}>Skills</Menu.Item>
          <Menu.Item id="reload-session" disabled={sessionRow.state !== "idle" || rows.nativeActionPending} onClick={() => onSessionAction("reload", sessionRow.sessionId)}>重载</Menu.Item>
          <Menu.Item id="rename-session" disabled={rows.renaming} onClick={() => onSessionAction("rename", sessionRow.sessionId)}>重命名</Menu.Item>
          {sessionRow.derivation && <Menu.Item id="manage-derived-session" disabled={rows.sessionManaging} onClick={() => onSessionAction("derivation", sessionRow.sessionId)}>派生会话管理</Menu.Item>}
          {(closed || unavailable) && <>
            <Menu.Item id="recover-kernel" disabled={rows.recovering} onClick={() => onSessionAction("recover", sessionRow.sessionId)}>恢复执行环境</Menu.Item>
          </>}
          {(closed || sleeping || unavailable) && <Menu.Item id="retarget-session" disabled={rows.recovering} onClick={() => onSessionAction("retarget", sessionRow.sessionId)}>换到新的执行环境…</Menu.Item>}
          <Menu.Divider />
          <Menu.Item id="clone-session" disabled={!CLONEABLE_STATES.has(sessionRow.state) || rows.nativeActionPending} onClick={() => onSessionAction("clone", sessionRow.sessionId)}>复制为新会话</Menu.Item>
          <Menu.Item id="export-html" disabled={closed || unavailable || sessionRow.state === "sleeping" || rows.nativeActionPending} onClick={() => onSessionAction("export-html", sessionRow.sessionId)}>导出为 HTML</Menu.Item>
          <Menu.Item id="export-jsonl" disabled={closed || unavailable || sessionRow.state === "sleeping" || rows.nativeActionPending} onClick={() => onSessionAction("export-jsonl", sessionRow.sessionId)}>导出为 JSONL</Menu.Item>
          <Menu.Item id="project-session" disabled={rows.projectMutating} onClick={() => onSessionAction("project", sessionRow.sessionId)}>所属项目</Menu.Item>
          <Menu.Item id="set-root-session" disabled={roles.root || !local} onClick={() => onSessionAction("root", sessionRow.sessionId)}>设为 root…</Menu.Item>
          <Menu.Item id="set-project-supervisor" disabled={roles.supervisor || !sessionRow.projectId} onClick={() => onSessionAction("supervisor", sessionRow.sessionId)}>设为项目 supervisor…</Menu.Item>
          <Menu.Divider />
          <Menu.Item id="archive-session" disabled={rows.archiving} onClick={() => onSessionAction("archive", sessionRow.sessionId)}>归档…</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
    {expanded && <div className="management-session-children" role="group" aria-label={`${sessionLabel}的子会话`}>
      {children.map((child) => <SessionRow key={child.sessionId} sessionRow={child} targets={targets} rows={rows} onSelected={onSelected} onSessionAction={onSessionAction} projectView={projectView} tree={tree} depth={depth + 1} drag={drag} />)}
    </div>}
    </div>
  );
}

import { Badge, Box, Flex, Stack, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import StatusDot from "../../design-system/status-dot/StatusDot.tsx";
import { MonitorMarks } from "../../monitor/button/MonitorMarks.tsx";
import { alertsOf } from "../../monitor/readings/alerts-of.ts";
import { deltaLabel } from "../../monitor/readings/delta-label.ts";
import { RoleBadges } from "../roles/RoleBadges.tsx";
import { sessionRoles } from "../roles/session-roles.ts";
import type { SessionRow as SessionRowData } from "../../workbench/store/store-types.ts";
import { CLOSED_STATES } from "./grouping/closed-last.ts";
import { highestUnder } from "./grouping/highest-under.ts";
import { statusPriority } from "./grouping/status-priority.ts";
import { visibleOwner } from "./grouping/visible-owner.ts";
import { derivationSummary } from "./labels/derivation-summary.ts";
import { rowState } from "./labels/row-state.ts";
import { sessionLabelById } from "./labels/session-label-by-id.ts";
import { sessionTargetLabel } from "./labels/session-target-label.ts";
import { SessionMenu } from "./SessionMenu.tsx";
import { sessionDragHandlers } from "./session-drag-handlers.ts";
import { MAX_TREE_DEPTH } from "./sidebar-constants.ts";
import type { RowContext, SessionAction, SessionDrag, TargetMap, TreeState } from "./sidebar-types.ts";
import "./session-row.css";

type SessionRowProps = {
  sessionRow: SessionRowData;
  targets: TargetMap;
  /** The sidebar's row inputs (sessions, selectedSessionId, sessionControl and in-flight action flags). */
  rows: RowContext;
  onSelected: (sessionId: string) => void;
  onSessionAction: SessionAction;
  projectView: boolean;
  tree: TreeState;
  depth?: number;
  drag?: SessionDrag | null;
};

// Project rows say nothing for an ordinary state; these are the ones worth a word there.
const NOTABLE_IN_PROJECT_VIEW = ["delivered", "compacting", "blocked", "stopped", "background", "done"];

export function SessionRow({ sessionRow, targets, rows, onSelected, onSessionAction, projectView, tree, depth = 0, drag = null }: SessionRowProps) {
  const { sessions } = rows;
  const selected = sessionRow.sessionId === rows.selectedSessionId;
  const sessionLabel = sessionRow.label.trim() || sessionRow.sessionId;
  const cwd = sessionRow.cwd.trim();
  const roles = sessionRoles(rows.sessionControl, sessionRow);
  const temporary = sessionRow.derivation?.lifecycle === "temporary";
  const child = Boolean(sessionRow.derivation);
  const shownState = rowState(sessionRow);
  // Show an implied parent for a child managed from another instance or project, with the manager in the tooltip.
  const remoteOwner = depth === 0 ? visibleOwner(sessionRow, sessions) : "";
  const remoteOwnerLabel = remoteOwner ? sessionLabelById(sessions, remoteOwner) : "";
  const children = depth < MAX_TREE_DEPTH ? tree.childrenOf.get(sessionRow.sessionId) || [] : [];
  const expanded = children.length > 0 && !tree.collapsed.has(sessionRow.sessionId);
  const descendantState = !expanded && highestUnder(children, tree.childrenOf);
  const stateBelow = descendantState && statusPriority(descendantState.key) > statusPriority(shownState.key) ? descendantState : null;
  const pendingOwner = sessionRow.derivation?.pendingOwner ?? "";
  const dragging = drag?.draggedSessionId === sessionRow.sessionId;
  const { onDragStart, onDragEnd } = sessionDragHandlers(sessionRow, drag, projectView && !rows.projectMutating);
  const title = [sessionLabel, cwd ? `工作目录：${cwd}` : "", remoteOwnerLabel ? `由 ${remoteOwnerLabel} 管理` : "", pendingOwner ? `待 ${sessionLabelById(sessions, pendingOwner)} 接收` : "", !cwd && !remoteOwnerLabel ? derivationSummary(sessionRow, sessions) : ""].filter(Boolean).join("\n");
  return (
    <Box className={`management-tree-node${temporary ? " is-temporary" : ""}${remoteOwnerLabel ? " management-tree-branch management-remote-owner-branch" : ""}`} __vars={{ "--tree-depth": String(depth) }}>
    <Flex
      align="center"
      ps="var(--tree-row-inset)"
      draggable={onDragStart !== undefined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-session-id={sessionRow.sessionId}
      data-status={sessionRow.state}
      data-phase={sessionRow.derivation?.phase}
      data-pending-owner={pendingOwner || undefined}
      data-alert={alertsOf(sessionRow).any ? "true" : undefined}
      data-delta={deltaLabel(sessionRow) ?? undefined}
      data-dragging={dragging ? "true" : undefined}
      aria-current={selected ? "true" : undefined}
      className={`management-session-row${selected ? " is-selected" : ""}${CLOSED_STATES.has(sessionRow.state) ? " is-closed" : ""}${temporary ? " is-temporary" : ""}${child ? " is-child" : ""}${dragging ? " is-dragging" : ""}`}
    >
      {children.length > 0
        ? <Flex component={UnstyledButton} align="center" justify="center" className="management-tree-toggle" w="var(--tree-caret-width)" h={24} flex="none" data-action="toggle-session-children" aria-expanded={expanded} aria-label={`${expanded ? "折叠" : "展开"}${sessionLabel}的子会话`} onClick={() => tree.toggle(sessionRow.sessionId)}>
          <IconChevronRight size={12} stroke={2.2} aria-hidden="true" />
        </Flex>
        : <Box w="var(--tree-caret-width)" flex="none" />}
      <UnstyledButton className="management-session-select" flex={1} miw={0} data-action="select-session" onClick={() => onSelected(sessionRow.sessionId)} aria-current={selected ? "true" : undefined} title={title}>
        <Flex align="center" gap="var(--tree-label-gap)">
          <Flex w="var(--tree-marker-width)" justify="center" flex="none"><StatusDot className="management-status-dot" data-session-dot="" tone={shownState.tone} size={temporary ? 5 : 7} /></Flex>
          <Stack component="span" gap={2} flex={1} miw={0} className="management-session-copy">
            <Flex component="span" align="center" gap={4} miw={0} mih={18} className="management-session-title">
              <strong>{sessionLabel}</strong>
              {pendingOwner ? <Badge component="span" variant="light" color="gray" size="xs" tt="none" radius="sm" className="management-session-pending" data-pending-owner={pendingOwner}>待接收</Badge> : null}
              <Flex component="span" align="center" gap={6} miw={0} ml="auto" pl={6} flex="none" className="management-session-aside">
                {stateBelow && <span data-descendant-state={stateBelow.key} role="img" aria-label={`子会话：${stateBelow.label}`} title={`子会话：${stateBelow.label}`}><StatusDot tone={stateBelow.tone} size={6} /></span>}
                <MonitorMarks sessionRow={sessionRow} />
                {(!projectView || sessionRow.state === "sleeping" || NOTABLE_IN_PROJECT_VIEW.includes(shownState.key)) && <span className="management-session-state" data-state={shownState.key}>{shownState.label}</span>}
              </Flex>
            </Flex>
            <Flex component="span" align="center" gap={4} miw={0} className="management-session-meta">
              <RoleBadges {...roles} />
              {child ? <Badge component="span" variant="outline" color="gray" size="xs" tt="none" radius="sm" className="management-session-capability" data-kind="child">子会话</Badge> : null}
              <span className="management-session-location">{sessionTargetLabel(sessionRow, targets)}</span>
            </Flex>
          </Stack>
        </Flex>
      </UnstyledButton>
      <SessionMenu sessionRow={sessionRow} rows={rows} roles={roles} local={targets.get(sessionRow.target)?.local === true} onSessionAction={onSessionAction} />
    </Flex>
    {expanded && <div className="management-tree-branch" role="group" aria-label={`${sessionLabel}的子会话`}>
      {children.map((childRow) => <SessionRow key={childRow.sessionId} sessionRow={childRow} targets={targets} rows={rows} onSelected={onSelected} onSessionAction={onSessionAction} projectView={projectView} tree={tree} depth={depth + 1} drag={drag} />)}
    </div>}
    </Box>
  );
}

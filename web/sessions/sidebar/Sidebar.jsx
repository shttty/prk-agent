import { useState } from "react";
import { memo } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { useMemo } from "react";
import { treeParent } from "./grouping/tree-parent.js";
import { MAX_TREE_DEPTH } from "./sidebar-constants.js";
import { targetMap } from "./grouping/target-map.js";
import { projectGroups } from "./grouping/project-groups.js";
import { canDropSessionToGroup, projectPayloadForGroup, sessionProjectGroup } from "./grouping/project-drop.js";
import { instanceGroups } from "./grouping/instance-groups.js";
import { Tooltip } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconLayoutSidebarLeftCollapse } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { IconServer2 } from "@tabler/icons-react";
import { SegmentedControl } from "@mantine/core";
import { Text } from "@mantine/core";
import { closedLast } from "./grouping/closed-last.js";
import { IconChevronRight } from "@tabler/icons-react";
import { LocalBadge } from "./LocalBadge.jsx";
import { IconMessageQuestion } from "@tabler/icons-react";
import { SessionRow } from "./SessionRow.jsx";
import StatusDot from "../../design-system/status-dot/StatusDot.jsx";
import { IconSun } from "@tabler/icons-react";
import { IconMoon } from "@tabler/icons-react";
import { IconSettings } from "@tabler/icons-react";
import "./sidebar.css";
import { UnreadableRow } from "../unreadable/UnreadableRow.jsx";
import { UnreadableReason } from "../unreadable/UnreadableReason.jsx";
import { unreadableItem } from "../unreadable/unreadable-item.js";
import { unknownLocationGroup } from "../unreadable/unknown-location-group.js";
import { useThemeToggle } from "../../design-system/theme/use-theme-toggle.js";
import { InstanceGroupActions } from "./InstanceGroupActions.jsx";
import { ProjectGroupActions } from "./ProjectGroupActions.jsx";
import { ProjectCreatedDate } from "./ProjectCreatedDate.jsx";
/** Session list region: subscribes to the fields below only, so stream deltas, typing and telemetry leave it alone. */
export const Sidebar = memo(function Sidebar({ actions, onCollapse, themeToggle, onOpen, onSettings, onSelected, onSessionAction }) {
  const toggleTheme = useThemeToggle();
  const viewMode = useWorkbench((state) => state.viewMode);
  const sessions = useWorkbench((state) => state.sessions);
  const targetList = useWorkbench((state) => state.targets);
  const unreadableSessions = useWorkbench((state) => state.unreadableSessions);
  const selectedSessionId = useWorkbench((state) => state.selectedSessionId);
  const service = useWorkbench((state) => state.service);
  const sessionConnection = useWorkbench((state) => state.session.connection);
  const reconnecting = useWorkbench((state) => state.session.pending.has("reconnecting"));
  const creating = useWorkbench((state) => state.pending.has("creating"));
  // Row menus: which session actions are in flight (SessionRow reads only these).
  const sessionControl = useWorkbench((state) => state.sessionControl);
  const nativeActionPending = useWorkbench((state) => state.session.pending.has("nativeActionPending"));
  const renaming = useWorkbench((state) => state.session.pending.has("renaming"));
  const sessionManaging = useWorkbench((state) => state.session.pending.has("sessionManaging"));
  const recovering = useWorkbench((state) => state.session.pending.has("recovering"));
  const archiving = useWorkbench((state) => state.session.pending.has("archiving"));
  const projectMutating = useWorkbench((state) => state.pending.has("projectMutating"));
  const rowContext = useMemo(() => ({ sessions, selectedSessionId, sessionControl, nativeActionPending, renaming, sessionManaging, recovering, archiving, projectMutating }),
    [sessions, selectedSessionId, sessionControl, nativeActionPending, renaming, sessionManaging, recovering, archiving, projectMutating]);
  const [openGroups, setOpenGroups] = useState({});
  const [viewingUnreadable, setViewingUnreadable] = useState(null);
  const [collapsedNodes, setCollapsedNodes] = useState(() => new Set());
  const projectView = viewMode === "projects";
  const [draggedSessionId, setDraggedSessionId] = useState(null);
  const [dropGroupId, setDropGroupId] = useState(null);
  const draggedSession = draggedSessionId ? sessions.get(draggedSessionId) ?? null : null;
  const clearDrag = () => { setDraggedSessionId(null); setDropGroupId(null); };
  const startDrag = (sessionRow) => { setDraggedSessionId(sessionRow.sessionId); setDropGroupId(null); };
  const finishDrop = (group, event) => {
    event.preventDefault();
    const id = draggedSessionId || event.dataTransfer?.getData("application/x-prk-session") || event.dataTransfer?.getData("text/plain");
    const source = id ? sessions.get(id) : null;
    const payload = projectPayloadForGroup(group);
    clearDrag();
    if (!source || payload === undefined || !canDropSessionToGroup(source, group)) return;
    void actions.assignProject(payload, source.sessionId);
  };
  // Derived sessions hang under their current manager (the relation deletion cascades along) when both sit in the same
  // group of the current view; expanded by default.
  const tree = useMemo(() => {
    const childrenOf = new Map();
    for (const sessionRow of [...sessions.values()].reverse()) {
      const owner = treeParent(sessionRow, sessions, projectView);
      if (owner) childrenOf.set(owner, [...(childrenOf.get(owner) || []), sessionRow]);
    }
    const toggle = (name) => setCollapsedNodes((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
    return { childrenOf, collapsed: collapsedNodes, toggle };
  }, [sessions, collapsedNodes, projectView]);
  const roots = (list) => list.filter((sessionRow) => !treeParent(sessionRow, sessions, projectView));
  const treeSize = (list, depth = 0) => depth > MAX_TREE_DEPTH ? 0 : list.reduce((sum, sessionRow) => sum + 1 + treeSize(tree.childrenOf.get(sessionRow.sessionId) || [], depth + 1), 0);
  const targets = useMemo(() => targetMap(targetList), [targetList]);
  // Unreadable active sessions take rows in their own instance/project group; archived ones live in the archive list;
  // those whose location is unknown get their own group instead of a guessed one.
  const unreadableRows = useMemo(() => unreadableSessions.filter((issue) => issue.location === "active").map(unreadableItem), [unreadableSessions]);
  const unknownRows = useMemo(() => unreadableSessions.filter((issue) => issue.location === "unknown").map(unreadableItem), [unreadableSessions]);
  const groups = useMemo(() => {
    const items = [...[...sessions.values()].reverse(), ...unreadableRows];
    const placed = projectView ? projectGroups(items) : instanceGroups(items, targetList);
    return unknownRows.length ? [...placed, unknownLocationGroup(unknownRows)] : placed;
  }, [targetList, sessions, unreadableRows, unknownRows, projectView]);
  const ungroupedPresent = projectView && groups.some((group) => group.id === "project:ungrouped" && closedLast(roots(group.sessions)).length > 0);
  const showUngroupedDrop = Boolean(projectView && draggedSession && !ungroupedPresent && sessionProjectGroup(draggedSession) !== "project:ungrouped");
  const sessionCount = [...sessions.values()].filter((sessionRow) => sessionRow.sessionId).length + unreadableRows.length + unknownRows.length;
  const toggle = (id) => setOpenGroups((current) => ({ ...current, [id]: current[id] === false }));
  const connection = selectedSessionId ? sessionConnection : service === "ready" ? "connected" : service === "loading" ? "connecting" : "disconnected";
  const connectionLabel = selectedSessionId
    ? reconnecting ? "正在重新连接…" : connection === "connected" ? "实时更新" : connection === "connecting" ? "正在连接…" : "未连接"
    : service === "ready" ? "服务已连接" : service === "loading" ? "正在连接服务…" : "服务不可用";
  const connectionTone = connection === "connected" ? "ok" : connection === "connecting" ? "run" : "error";

  return (
    <aside className="management-sidebar" aria-label="实例与会话列表">
      <div className="management-brand">
        <span className="management-brand-mark" aria-hidden="true" />
        <span className="management-brand-name">PI WORKBENCH</span>
        {onCollapse && <Tooltip label="收起会话栏"><ActionIcon className="management-brand-collapse" id="toggle-session-sidebar" variant="subtle" color="gray" size="sm" aria-label="收起会话栏" aria-expanded="true" onClick={onCollapse}><IconLayoutSidebarLeftCollapse size={17} /></ActionIcon></Tooltip>}
      </div>
      <div className="management-sidebar-heading">
        <Button id="create-session" className="management-primary-action" variant="filled" leftSection={<IconPlus size={16} />} onClick={() => onOpen("create")} disabled={creating}>新建会话</Button>
        <Button id="manage-targets" variant="default" leftSection={<IconServer2 size={15} />} onClick={() => onOpen("targets")}>实例</Button>
      </div>
      <SegmentedControl
        id="management-view-switch"
        className="management-view-switch"
        fullWidth
        size="xs"
        mt="sm"
        value={viewMode}
        onChange={(value) => actions.setViewMode(value)}
        data={[{ label: "实例", value: "instances" }, { label: "项目", value: "projects" }]}
      />
      <div className="management-list-heading">
        <span>{viewMode === "projects" ? "项目与会话" : "实例与会话"}</span>
        <span className="management-count">{sessionCount}</span>
      </div>
      <div className="management-sidebar-list" aria-label={viewMode === "projects" ? "按项目分组的会话" : "按实例分组的会话"}>
        {!groups.length && <Text size="sm" c="dimmed" px="xs" py="md">{service === "error" ? "无法读取会话列表。" : "暂无会话。"}</Text>}
        {groups.map((group) => {
          const top = closedLast(roots(group.sessions));
          const open = openGroups[group.id] !== false;
          if (projectView && !top.length) return null;
          // A folded group says it holds a waiting ask (an open one shows the row itself).
          const askHere = !open && group.sessions.some((sessionRow) => sessionRow.asking === true);
          const header = <button type="button" className="management-group-header" onClick={() => toggle(group.id)} aria-expanded={open} data-asking={askHere ? "true" : undefined}>
            <IconChevronRight className="management-group-caret" size={14} stroke={2} aria-hidden="true" /><span>{group.name}</span>
            {projectView && <ProjectCreatedDate created={group.created} />}
            {group.target?.local === true && <LocalBadge />}
            {askHere && <IconMessageQuestion className="management-ask-mark" data-ask-mark="group" role="img" aria-label="有问题等待回答" size={14} stroke={2} />}
            <span className="management-count">{treeSize(top)}</span>
          </button>;
          const droppable = projectView && canDropSessionToGroup(draggedSession, group);
          const dropActive = droppable && dropGroupId === group.id;
          return (
            <section
              className="management-group"
              key={group.id}
              data-group={group.id}
              data-droppable={droppable ? "true" : undefined}
              data-drop-target={dropActive ? "true" : undefined}
              onDragOver={droppable ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (dropGroupId !== group.id) setDropGroupId(group.id); } : undefined}
              onDragLeave={droppable ? (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropGroupId((current) => (current === group.id ? null : current)); } : undefined}
              onDrop={droppable ? (event) => finishDrop(group, event) : undefined}
            >
              <div className="management-group-header-row">
                {header}
                {projectView ? <ProjectGroupActions group={group} creating={creating} onOpen={onOpen} /> : <InstanceGroupActions group={group} actions={actions} creating={creating} onOpen={onOpen} />}
              </div>
              {open && <div className="management-group-children">
                {top.map((sessionRow) => sessionRow.unreadable
                  ? <UnreadableRow key={sessionRow.key} item={sessionRow} targets={targets} onOpen={setViewingUnreadable} />
                  : <SessionRow key={sessionRow.sessionId} sessionRow={sessionRow} targets={targets} rows={rowContext} onSelected={onSelected} onSessionAction={onSessionAction} projectView={projectView} tree={tree} drag={projectView ? { draggedSessionId, onStart: startDrag, onEnd: clearDrag } : null} />)}
              </div>}
            </section>
          );
        })}
        {showUngroupedDrop ? (
          <section
            className="management-group management-drop-ungrouped"
            data-group="project:ungrouped"
            data-droppable="true"
            data-drop-target={dropGroupId === "project:ungrouped" ? "true" : undefined}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (dropGroupId !== "project:ungrouped") setDropGroupId("project:ungrouped"); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropGroupId((current) => (current === "project:ungrouped" ? null : current)); }}
            onDrop={(event) => finishDrop({ id: "project:ungrouped", name: "未归类" }, event)}
          >
            <div className="management-drop-zone-label">拖到此处移出项目（未归类）</div>
          </section>
        ) : null}
      </div>
      <div className="management-sidebar-footer">
        <StatusDot className="management-connection-dot" tone={connectionTone} size={7} />
        <Text id="management-connection-status" data-status={connection} size="xs" c="dimmed" role="status">{connectionLabel}</Text>
        {themeToggle && <Tooltip label="切换明暗主题"><ActionIcon id="theme-toggle" variant="subtle" color="gray" size="sm" aria-label="切换明暗主题" onClick={toggleTheme}><IconSun className="light-theme-icon" size={16} /><IconMoon className="dark-theme-icon" size={16} /></ActionIcon></Tooltip>}
        <Tooltip label="设置"><ActionIcon id="open-settings" variant="subtle" color="gray" size="sm" aria-label="设置" onClick={onSettings}><IconSettings size={16} /></ActionIcon></Tooltip>
      </div>
      <UnreadableReason issue={unreadableSessions.find((issue) => issue.key === viewingUnreadable)} onClose={() => setViewingUnreadable(null)} />
    </aside>
  );
});

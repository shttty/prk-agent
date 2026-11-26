import { memo, useMemo, useState } from "react";
import { ActionIcon, Box, Button, Flex, Group, SegmentedControl, Text, Tooltip } from "@mantine/core";
import { IconLayoutSidebarLeftCollapse, IconPlus, IconServer2 } from "@tabler/icons-react";
import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { SessionRows, UnreadableIssue } from "../session-row-types.ts";
import { UnreadableReason } from "../unreadable/UnreadableReason.tsx";
import { UnreadableRow } from "../unreadable/UnreadableRow.tsx";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import type { WorkbenchReads } from "../workbench-reads-types.ts";
import { GroupHeader } from "./GroupHeader.tsx";
import { InstanceGroupActions } from "./InstanceGroupActions.tsx";
import { ProjectGroupActions } from "./ProjectGroupActions.tsx";
import { SessionRow } from "./SessionRow.tsx";
import { SidebarFooter } from "./SidebarFooter.tsx";
import { canDropSessionToGroup } from "./grouping/can-drop-session-to-group.ts";
import { closedLast } from "./grouping/closed-last.ts";
import { highestUnder } from "./grouping/highest-under.ts";
import { projectPayloadForGroup } from "./grouping/project-payload-for-group.ts";
import { sessionProjectGroup } from "./grouping/session-project-group.ts";
import type { OpenDialog, RowContext, SessionAction } from "./sidebar-types.ts";
import { useSessionDrag } from "./use-session-drag.ts";
import { useSidebarGroups } from "./use-sidebar-groups.ts";
import "./sidebar.css";
import "./tree-lines.css";
import "./group-header.css";
import "./badges.css";

type SidebarProps = {
  actions: WorkbenchActions;
  onCollapse?: () => void;
  themeToggle: boolean;
  onOpen: OpenDialog;
  onSettings: () => void;
  onSelected: (sessionId: string) => void;
  onSessionAction: SessionAction;
};

/** Session list region: subscribes to the fields below only, so stream deltas, typing and telemetry leave it alone. */
export const Sidebar = memo(function Sidebar({ actions, onCollapse, themeToggle, onOpen, onSettings, onSelected, onSessionAction }: SidebarProps) {
  const viewMode: WorkbenchReads["viewMode"] = useWorkbench((state: WorkbenchReads) => state.viewMode);
  const sessions: SessionRows = useWorkbench((state: WorkbenchReads) => state.sessions);
  const targetList: PublicExecutionTarget[] = useWorkbench((state: WorkbenchReads) => state.targets);
  const unreadableSessions: UnreadableIssue[] = useWorkbench((state: WorkbenchReads) => state.unreadableSessions);
  const selectedSessionId: string | null = useWorkbench((state: WorkbenchReads) => state.selectedSessionId);
  const service: WorkbenchReads["service"] = useWorkbench((state: WorkbenchReads) => state.service);
  const creating = useWorkbench((state: WorkbenchReads) => state.pending.has("creating"));
  // Row menus: which session actions are in flight (SessionRow reads only these).
  const sessionControl: RowContext["sessionControl"] = useWorkbench((state: WorkbenchReads) => state.sessionControl);
  const nativeActionPending = useWorkbench((state: WorkbenchReads) => state.session.pending.has("nativeActionPending"));
  const renaming = useWorkbench((state: WorkbenchReads) => state.session.pending.has("renaming"));
  const sessionManaging = useWorkbench((state: WorkbenchReads) => state.session.pending.has("sessionManaging"));
  const recovering = useWorkbench((state: WorkbenchReads) => state.session.pending.has("recovering"));
  const archiving = useWorkbench((state: WorkbenchReads) => state.session.pending.has("archiving"));
  const projectMutating = useWorkbench((state: WorkbenchReads) => state.pending.has("projectMutating"));
  const rowContext = useMemo<RowContext>(() => ({ sessions, selectedSessionId, sessionControl, nativeActionPending, renaming, sessionManaging, recovering, archiving, projectMutating }),
    [sessions, selectedSessionId, sessionControl, nativeActionPending, renaming, sessionManaging, recovering, archiving, projectMutating]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [viewingUnreadable, setViewingUnreadable] = useState<string | null>(null);
  const projectView = viewMode === "projects";
  const { draggedSession, dropGroupId, drag, dropProps } = useSessionDrag(actions, sessions);
  const { tree, targets, groups, roots, treeSize, sessionCount, ungroupedPresent } = useSidebarGroups(sessions, targetList, unreadableSessions, projectView);
  const showUngroupedDrop = Boolean(projectView && draggedSession && !ungroupedPresent && sessionProjectGroup(draggedSession) !== "project:ungrouped");
  const toggle = (id: string) => setOpenGroups((current) => ({ ...current, [id]: current[id] === false }));
  const ungroupedZone = { id: "project:ungrouped", name: "未归类" };

  return (
    <Flex component="aside" direction="column" className="management-sidebar" aria-label="实例与会话列表">
      <Flex align="center" gap={10} px={8} pb={16}>
        <span className="management-brand-mark" aria-hidden="true" />
        <span className="management-brand-name">PI WORKBENCH</span>
        {onCollapse && <Tooltip label="收起会话栏"><ActionIcon ml="auto" my={-4} id="toggle-session-sidebar" variant="subtle" color="gray" size="sm" aria-label="收起会话栏" aria-expanded="true" onClick={onCollapse}><IconLayoutSidebarLeftCollapse size={17} /></ActionIcon></Tooltip>}
      </Flex>
      <Group gap={6} wrap="nowrap" className="management-sidebar-heading">
        <Button id="create-session" flex={1} className="management-primary-action" variant="filled" leftSection={<IconPlus size={16} />} onClick={() => onOpen("create")} disabled={creating}>新建会话</Button>
        <Button id="manage-targets" variant="default" leftSection={<IconServer2 size={15} />} onClick={() => onOpen("targets")}>实例</Button>
      </Group>
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
      <Flex align="center" justify="space-between" mt={18} mb={4} mx={8} className="management-list-heading">
        <span>{projectView ? "项目与会话" : "实例与会话"}</span>
        <span className="management-count">{sessionCount}</span>
      </Flex>
      <Box flex={1} mih={0} className="management-sidebar-list" data-session-list="" aria-label={projectView ? "按项目分组的会话" : "按实例分组的会话"}>
        {!groups.length && <Text size="sm" c="dimmed" px="xs" py="md">{service === "error" ? "无法读取会话列表。" : "暂无会话。"}</Text>}
        {showUngroupedDrop ? (
          <section
            className="management-group management-drop-ungrouped"
            data-group="project:ungrouped"
            data-droppable="true"
            data-drop-target={dropGroupId === "project:ungrouped" ? "true" : undefined}
            {...dropProps(ungroupedZone, true)}
          >
            <div className="management-drop-zone-label">拖到此处移出项目（未归类）</div>
          </section>
        ) : null}
        {groups.map((group) => {
          const top = closedLast(roots(group.sessions));
          if (projectView && !top.length) return null;
          const ungrouped = projectView && group.id === "project:ungrouped";
          const project = projectView ? projectPayloadForGroup(group) : undefined;
          const open = ungrouped || openGroups[group.id] !== false;
          const droppable = projectView && canDropSessionToGroup(draggedSession, group);
          return (
            <section
              className="management-group"
              key={group.id}
              data-group={group.id}
              data-group-kind={ungrouped ? "ungrouped" : project ? "project" : undefined}
              data-droppable={droppable ? "true" : undefined}
              data-drop-target={droppable && dropGroupId === group.id ? "true" : undefined}
              {...dropProps(group, droppable)}
            >
              {!ungrouped && <Flex align="center" gap={2} mr={2} pl="var(--tree-row-inset)" pr={4} className="management-group-header-row">
                <GroupHeader group={group} project={project} open={open} onToggle={() => toggle(group.id)} count={project && open ? undefined : treeSize(top)} state={!open && highestUnder(group.sessions.filter((item) => item.state !== "unreadable"))} />
                {project ? <ProjectGroupActions project={project} creating={creating} onOpen={onOpen} /> : !projectView && <InstanceGroupActions group={group} actions={actions} creating={creating} onOpen={onOpen} />}
              </Flex>}
              {open && <div className={`management-group-children${project ? " management-tree-branch" : ""}`}>
                {top.map((item) => item.state === "unreadable"
                  ? <UnreadableRow key={item.key} item={item} targets={targets} onOpen={setViewingUnreadable} />
                  : <SessionRow key={item.sessionId} sessionRow={item} targets={targets} rows={rowContext} onSelected={onSelected} onSessionAction={onSessionAction} projectView={projectView} tree={tree} drag={projectView ? drag : null} />)}
              </div>}
            </section>
          );
        })}
      </Box>
      <SidebarFooter themeToggle={themeToggle} onSettings={onSettings} />
      <UnreadableReason issue={unreadableSessions.find((issue) => issue.key === viewingUnreadable)} onClose={() => setViewingUnreadable(null)} />
    </Flex>
  );
});

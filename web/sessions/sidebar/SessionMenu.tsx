import { ActionIcon, Menu } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import type { SessionRow } from "../../workbench/store/store-types.ts";
import { CLONEABLE_STATES } from "./sidebar-constants.ts";
import type { RowContext, SessionAction } from "./sidebar-types.ts";

type SessionMenuProps = { sessionRow: SessionRow; rows: RowContext; roles: { root: boolean; supervisor: boolean }; local: boolean; onSessionAction: SessionAction };

/** A session row's "…" menu: details, tools, recovery, export, project and role, archive. */
export function SessionMenu({ sessionRow, rows, roles, local, onSessionAction }: SessionMenuProps) {
  const { sessionId, state } = sessionRow;
  const closed = state === "closed";
  const sleeping = state === "sleeping";
  const unavailable = state === "unavailable";
  const act = (type: string) => () => onSessionAction(type, sessionId);
  return (
    // Long menu: flip to the roomier side and cap to the viewport, scrolling inside (phones).
    <Menu position="bottom-end" withinPortal middlewares={{ flip: { fallbackStrategy: "bestFit" }, shift: true, size: { padding: 8 } }}>
      <Menu.Target><ActionIcon className="management-session-menu" data-action="session-menu" variant="subtle" color="gray" size={30} radius="md" mr={6} aria-label={`${sessionRow.label || sessionId}的会话设置`}><IconDots size={16} /></ActionIcon></Menu.Target>
      <Menu.Dropdown className="management-session-dropdown">
        <Menu.Label>{sessionRow.label || sessionId}</Menu.Label>
        <Menu.Item id="session-details" onClick={act("details")}>会话详情</Menu.Item>
        <Menu.Item id="session-tools" disabled={closed || unavailable} onClick={act("tools")}>工具</Menu.Item>
        <Menu.Item id="session-skills" disabled={closed || unavailable} onClick={act("skills")}>Skills</Menu.Item>
        <Menu.Item id="reload-session" disabled={state !== "idle" || rows.nativeActionPending} onClick={act("reload")}>重载</Menu.Item>
        <Menu.Item id="rename-session" disabled={rows.renaming} onClick={act("rename")}>重命名</Menu.Item>
        {sessionRow.derivation && <Menu.Item id="manage-derived-session" disabled={rows.sessionManaging} onClick={act("derivation")}>派生会话管理</Menu.Item>}
        {(closed || unavailable) && <Menu.Item id="recover-kernel" disabled={rows.recovering} onClick={act("recover")}>恢复执行环境</Menu.Item>}
        {(closed || sleeping || unavailable) && <Menu.Item id="retarget-session" disabled={rows.recovering} onClick={act("retarget")}>换到新的执行环境…</Menu.Item>}
        <Menu.Divider />
        <Menu.Item id="clone-session" disabled={!CLONEABLE_STATES.has(state) || rows.nativeActionPending} onClick={act("clone")}>复制为新会话</Menu.Item>
        <Menu.Item id="export-html" disabled={closed || unavailable || sleeping || rows.nativeActionPending} onClick={act("export-html")}>导出为 HTML</Menu.Item>
        <Menu.Item id="export-jsonl" disabled={closed || unavailable || sleeping || rows.nativeActionPending} onClick={act("export-jsonl")}>导出为 JSONL</Menu.Item>
        <Menu.Item id="project-session" disabled={rows.projectMutating} onClick={act("project")}>所属项目</Menu.Item>
        <Menu.Item id="set-root-session" disabled={roles.root || !local} onClick={act("root")}>设为 root…</Menu.Item>
        <Menu.Item id="set-project-supervisor" disabled={roles.supervisor || !sessionRow.projectId} onClick={act("supervisor")}>设为项目 supervisor…</Menu.Item>
        <Menu.Divider />
        <Menu.Item id="archive-session" disabled={rows.archiving} onClick={act("archive")}>归档…</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

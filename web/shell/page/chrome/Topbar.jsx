import { Group } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { Tooltip } from "@mantine/core";
import { Title } from "@mantine/core";
import { IconMenu2 } from "@tabler/icons-react";
import { IconLayoutSidebarRight } from "@tabler/icons-react";
import { IconSun } from "@tabler/icons-react";
import { IconMoon } from "@tabler/icons-react";
import { AnsiText } from "../../../chat/ansi/AnsiText.jsx";
import { label } from "../../../sessions/details/status-label.js";
import { statusTone } from "../../../sessions/details/status-tone.js";
import StatusDot from "../../../design-system/status-dot/StatusDot.jsx";
import MonitorButton from "../../../monitor/button/MonitorButton.jsx";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
import { useThemeToggle } from "../../../design-system/theme/use-theme-toggle.js";

/** The page's top bar. Phone: menu, title (eyebrow: 子会话 · instance · project), status, and the panel buttons
 * (reconnect, monitor sheet, workspace, theme; the workspace overlay has its own close button under the same id).
 * Desktop: kept in the DOM, visually hidden (page title and state hooks for assistive tech and tests); the visible
 * heading is the chat column's SessionHeading. */
export function Topbar({ mobile, sessionRow, status, place, sidebarOpen, onOpenSidebar, recoverButton, monitorSheet, onToggleMonitor, workspaceAvailable, workspaceOpen, onToggleWorkspace }) {
  const pluginTitle = useWorkbench((state) => state.session.extensionUi?.title);
  const onToggleTheme = useThemeToggle();
  return <header className={`topbar${mobile ? "" : " is-hidden"}`}>
    <Group gap="sm" wrap="nowrap" className="topbar-leading">
      <ActionIcon className="mobile-menu" id="open-sidebar" variant="subtle" color="gray" size="lg" aria-label="打开会话列表" aria-expanded={sidebarOpen} onClick={onOpenSidebar}><IconMenu2 size={20} /></ActionIcon>
      <div className="topbar-heading">{sessionRow && <span className="topbar-eyebrow">{[sessionRow.derivation ? "子会话" : "", place, sessionRow.projectName].filter(Boolean).join(" · ")}</span>}<Title order={1} size="h4" id="topbar-title"><AnsiText text={pluginTitle || sessionRow?.label || "Pi 工作台"} /></Title></div>
    </Group>
    <Group gap="xs" wrap="nowrap">
      {sessionRow && <span className="topbar-status" data-status={status} title={`会话状态：${label(status)}`}><StatusDot tone={statusTone(status)} size={7} /><span className="topbar-status-label">{label(status)}</span></span>}
      {mobile && recoverButton}
      {mobile && sessionRow && <MonitorButton sessionRow={sessionRow} opened={monitorSheet} onToggle={onToggleMonitor} />}
      {mobile && workspaceAvailable && !workspaceOpen && <Tooltip label="工作区"><ActionIcon id="toggle-workspace" variant="subtle" color="gray" size="lg" aria-label="展开工作区" aria-expanded={false} onClick={onToggleWorkspace}><IconLayoutSidebarRight size={19} /></ActionIcon></Tooltip>}
      {mobile && <Tooltip label="切换明暗主题"><ActionIcon id="theme-toggle" variant="subtle" color="gray" size="lg" aria-label="切换明暗主题" onClick={onToggleTheme}><IconSun className="light-theme-icon" size={19} /><IconMoon className="dark-theme-icon" size={19} /></ActionIcon></Tooltip>}
    </Group>
  </header>;
}

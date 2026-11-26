import type { ReactNode } from "react";
import { ActionIcon, Flex, Group, Stack, Text, Title, Tooltip, VisuallyHidden } from "@mantine/core";
import { IconLayoutSidebarRight, IconMenu2, IconMoon, IconSun } from "@tabler/icons-react";
import type { WorkbenchState } from "../page-types.ts";
import { AnsiText } from "../../../chat/ansi/AnsiText.jsx";
import { label } from "../../../sessions/details/status-label.js";
import { statusTone } from "../../../sessions/details/status-tone.js";
import StatusDot from "../../../design-system/status-dot/StatusDot.tsx";
import MonitorButton from "../../../monitor/button/MonitorButton.jsx";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
import { useThemeToggle } from "../../../design-system/theme/use-theme-toggle.ts";
import type { SelectedRow } from "../../../workbench/store/store-types.ts";

type TopbarProps = {
  mobile: boolean;
  sessionRow: SelectedRow | undefined;
  status: string | undefined;
  place: string;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  recoverButton: ReactNode;
  monitorSheet: boolean;
  onToggleMonitor: () => void;
  workspaceAvailable: boolean;
  workspaceOpen: boolean;
  onToggleWorkspace: () => void;
};

/** The page's top bar. Phone: menu, title (eyebrow: 子会话 · instance · project), status, and the panel buttons
 * (reconnect, monitor sheet, workspace, theme; the workspace overlay has its own close button under the same id).
 * Desktop: kept in the DOM, visually hidden (page title and state hooks for assistive tech and tests); the visible
 * heading is the chat column's SessionHeading. */
export function Topbar({ mobile, sessionRow, status, place, sidebarOpen, onOpenSidebar, recoverButton, monitorSheet, onToggleMonitor, workspaceAvailable, workspaceOpen, onToggleWorkspace }: TopbarProps) {
  const pluginTitle = useWorkbench((state: WorkbenchState) => state.session.extensionUi?.title);
  const onToggleTheme = useThemeToggle();
  const bar = <Flex component="header" className="topbar" mih={mobile ? 58 : 70} px={mobile ? 10 : 24} py={mobile ? 8 : 12} gap={mobile ? 6 : 12} align="center" justify="space-between" wrap="nowrap">
    <Group gap="sm" wrap="nowrap" miw={0} className="topbar-leading">
      {mobile && <ActionIcon id="open-sidebar" variant="subtle" color="gray" size="lg" aria-label="打开会话列表" aria-expanded={sidebarOpen} onClick={onOpenSidebar}><IconMenu2 size={20} /></ActionIcon>}
      <Stack gap={2} miw={0}>
        {sessionRow && <Text className="topbar-eyebrow" size="xs" truncate>{[sessionRow.derivation ? "子会话" : "", place, sessionRow.projectName].filter(Boolean).join(" · ")}</Text>}
        <Title order={1} size={mobile ? 18 : 23} fw={500} lh={1.3} ff="var(--pi-font-display)" lineClamp={1} id="topbar-title"><AnsiText text={pluginTitle || sessionRow?.label || "Pi 工作台"} /></Title>
      </Stack>
    </Group>
    <Group gap="xs" wrap="nowrap">
      {sessionRow && <Group className="topbar-status" data-status={status} title={`会话状态：${label(status)}`} gap={7} wrap="nowrap" h={mobile ? 26 : 28} px={mobile ? 8 : 11}><StatusDot tone={statusTone(status)} size={7} />{mobile ? null : <span>{label(status)}</span>}</Group>}
      {mobile && recoverButton}
      {mobile && sessionRow && <MonitorButton sessionRow={sessionRow} opened={monitorSheet} onToggle={onToggleMonitor} />}
      {mobile && workspaceAvailable && !workspaceOpen && <Tooltip label="工作区"><ActionIcon id="toggle-workspace" variant="subtle" color="gray" size="lg" aria-label="展开工作区" aria-expanded={false} onClick={onToggleWorkspace}><IconLayoutSidebarRight size={19} /></ActionIcon></Tooltip>}
      {mobile && <Tooltip label="切换明暗主题"><ActionIcon id="theme-toggle" variant="subtle" color="gray" size="lg" aria-label="切换明暗主题" onClick={onToggleTheme}><IconSun className="light-theme-icon" size={19} /><IconMoon className="dark-theme-icon" size={19} /></ActionIcon></Tooltip>}
    </Group>
  </Flex>;
  return mobile ? bar : <VisuallyHidden>{bar}</VisuallyHidden>;
}

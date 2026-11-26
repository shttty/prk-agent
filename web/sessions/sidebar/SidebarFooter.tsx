import { ActionIcon, Flex, Text, Tooltip } from "@mantine/core";
import { IconMoon, IconSettings, IconSun } from "@tabler/icons-react";
import StatusDot from "../../design-system/status-dot/StatusDot.tsx";
import { useThemeToggle } from "../../design-system/theme/use-theme-toggle.ts";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";

type SidebarFooterProps = { themeToggle: boolean; onSettings: () => void };

/** The connection line (the selected session's stream, else the service) with the theme and settings buttons. */
export function SidebarFooter({ themeToggle, onSettings }: SidebarFooterProps) {
  const toggleTheme = useThemeToggle();
  const service: WorkbenchState["service"] = useWorkbench((state: WorkbenchState) => state.service);
  const selectedSessionId: string | null = useWorkbench((state: WorkbenchState) => state.selectedSessionId);
  const sessionConnection: WorkbenchState["session"]["connection"] = useWorkbench((state: WorkbenchState) => state.session.connection);
  const reconnecting = useWorkbench((state: WorkbenchState) => state.session.pending.has("reconnecting"));
  const connection = selectedSessionId ? sessionConnection : service === "ready" ? "connected" : service === "loading" ? "connecting" : "disconnected";
  const label = selectedSessionId
    ? reconnecting ? "正在重新连接…" : connection === "connected" ? "实时更新" : connection === "connecting" ? "正在连接…" : "未连接"
    : service === "ready" ? "服务已连接" : service === "loading" ? "正在连接服务…" : "服务不可用";
  const tone = connection === "connected" ? "ok" : connection === "connecting" ? "run" : "error";
  return (
    <Flex align="center" gap={2} mih={36} mt={8} pt={8} pr={2} pl={12} className="management-sidebar-footer">
      <StatusDot className="management-connection-dot" tone={tone} size={7} />
      <Text id="management-connection-status" data-status={connection} size="xs" c="var(--pi-sidebar-dim)" truncate="end" flex="1 1 0" miw={0} ml={6} mr={4} role="status">{label}</Text>
      {themeToggle && <Tooltip label="切换明暗主题"><ActionIcon id="theme-toggle" variant="subtle" color="gray" size="sm" aria-label="切换明暗主题" onClick={toggleTheme}><IconSun className="light-theme-icon" size={16} /><IconMoon className="dark-theme-icon" size={16} /></ActionIcon></Tooltip>}
      <Tooltip label="设置"><ActionIcon id="open-settings" variant="subtle" color="gray" size="sm" aria-label="设置" onClick={onSettings}><IconSettings size={16} /></ActionIcon></Tooltip>
    </Flex>
  );
}

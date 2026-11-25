import { useState } from "react";
import { Text } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import StatusDot from "../../design-system/status-dot/StatusDot.jsx";
import { Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
export function SessionResources({ actions }) {
  const [reloading, setReloading] = useState(false);
  const catalog = useWorkbench((state) => state.session.nativeCatalog?.value);
  const ready = useWorkbench((state) => ["idle", "sleeping"].includes(state.session.snapshot?.state) && state.session.connection === "connected" && !state.session.pending.has("nativeActionPending"));
  const resources = Array.isArray(catalog?.resources) ? catalog.resources : [];
  const reloadCommand = (catalog?.commands || []).find((command) => command?.name === "reload" && command.source === "builtin");
  const reloadEnabled = Boolean(reloadCommand) && reloadCommand.availability?.enabled !== false && reloadCommand.enabled !== false && ready;
  if (!reloadCommand && !resources.length) return null;
  const reload = () => {
    setReloading(true);
    void Promise.resolve(actions.executeNativeAction("reload", {}, { transcript: false })).finally(() => setReloading(false));
  };
  return <section className="session-section" aria-label="资源与扩展">
    <Text className="session-section-title">资源与扩展</Text>
    <Stack gap={6}>
      {resources.map((resource, index) => {
        const providers = Array.isArray(resource.providers) ? resource.providers : [];
        const state = resource.loaded ? "已加载" : resource.disabled ? "已禁用" : "未加载";
        return <Group key={`${resource.type || "resource"}-${resource.name || ""}-${resource.path || ""}-${index}`} gap={8} wrap="nowrap" data-resource-type={resource.type} data-resource-name={resource.name} data-resource-code={resource.code} data-resource-providers={providers.join(",") || undefined}>
          <StatusDot tone={resource.loaded ? "ok" : resource.disabled ? "idle" : "error"} size={7} />
          <Text size="xs">{resource.name || resource.type}: {state}{providers.length ? ` · provider：${providers.join(", ")}` : ""}{resource.reason ? ` · ${resource.reason}` : ""}</Text>
        </Group>;
      })}
      {reloadCommand ? <Group gap="sm" wrap="nowrap" align="center">
        <Button id="reload-resources" size="compact-xs" variant="default" leftSection={<IconRefresh size={13} stroke={1.8} />} disabled={!reloadEnabled} loading={reloading} onClick={reload}>重新加载</Button>
        <Text size="xs" c="dimmed">{ready ? "改了设置、扩展、技能或模板后重新读取。" : "会话空闲时可以重新加载。"}</Text>
      </Group> : null}
    </Stack>
  </section>;
}


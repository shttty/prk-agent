import { Text } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import StatusDot from "../../design-system/status-dot/StatusDot.tsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { NativeCatalog, WorkbenchReads } from "../workbench-reads-types.ts";
export function SessionResources() {
  const catalog: NativeCatalog | null | undefined = useWorkbench((state: WorkbenchReads) => state.session.nativeCatalog?.value);
  const resources = catalog?.resources ?? [];
  if (!resources.length) return null;
  return <section className="session-section" aria-label="资源与扩展">
    <Text className="session-section-title">资源与扩展</Text>
    <Stack gap={6}>
      {resources.map((resource, index) => {
        const providers = resource.providers ?? [];
        const state = resource.loaded ? "已加载" : resource.disabled ? "已禁用" : "未加载";
        return <Group key={`${resource.type || "resource"}-${resource.name || ""}-${resource.path || ""}-${index}`} gap={8} wrap="nowrap" data-resource-type={resource.type} data-resource-name={resource.name} data-resource-code={resource.code} data-resource-providers={providers.join(",") || undefined}>
          <StatusDot tone={resource.loaded ? "ok" : resource.disabled ? "idle" : "error"} size={7} />
          <Text size="xs">{resource.name || resource.type}: {state}{providers.length ? ` · provider：${providers.join(", ")}` : ""}{resource.reason ? ` · ${resource.reason}` : ""}</Text>
        </Group>;
      })}
    </Stack>
  </section>;
}


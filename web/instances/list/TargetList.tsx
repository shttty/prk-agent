import { useState } from "react";
import { Button, Card, Group, Stack, Text } from "@mantine/core";
import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import { FormError } from "../../design-system/form-error/FormError.tsx";
import { runDialogAction } from "../../sessions/dialogs/run-dialog-action.ts";
import { labelForTarget } from "../../sessions/sidebar/labels/label-for-target.ts";
import { LocalBadge } from "../../sessions/sidebar/LocalBadge.tsx";
import type { WorkbenchActions } from "../../sessions/workbench-actions-types.ts";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { ConfigurationIssueBadge } from "../configuration-issue/ConfigurationIssueBadge.tsx";
import "./list.css";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";

type TargetListProps = { actions: WorkbenchActions; onEdit: (id: string) => void; onAdd: () => void; onSettings: (id: string) => void; loadingId: string | null };

export function TargetList({ actions, onEdit, onAdd, onSettings, loadingId }: TargetListProps) {
  const targets: PublicExecutionTarget[] = useWorkbench((state: WorkbenchState) => state.targets);
  const reloading = useWorkbench((state: WorkbenchState) => state.pending.has("reloadingTargets"));
  const mutating = useWorkbench((state: WorkbenchState) => state.pending.has("targetMutating"));
  const sessionError: string | null = useWorkbench((state: WorkbenchState) => state.session.error);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const busy = mutating || loadingId !== null;
  async function remove() {
    if (!pendingDelete) return;
    setError("");
    await runDialogAction(() => actions.deleteTarget(pendingDelete), () => setPendingDelete(null), setError, "实例删除失败。 ", "实例删除失败。 ");
  }
  return (
    <Stack gap="md">
      <Group justify="space-between"><Button id="add-target" onClick={onAdd}>添加实例</Button><Button variant="default" onClick={() => void actions.reloadTargets()} loading={reloading || mutating}>刷新配置</Button></Group>
      <FormError>{error || sessionError}</FormError>
      {!targets.length && <Text size="sm" c="dimmed">暂无服务端实例配置。</Text>}
      {targets.map((target) => <Card key={target.id} withBorder padding="sm">
        <Group justify="space-between" wrap="nowrap" py={8}>
          <Stack gap={0} flex={1} miw={0}>
            <Text size="sm" fw={500} truncate="end">{labelForTarget(target)}{target.local && <LocalBadge />} <ConfigurationIssueBadge issue={target.configurationIssue} onOpen={() => onEdit(target.id)} /></Text>
            <Text size="xs" c="dimmed" truncate="end">{target.tags.length ? target.tags.join(" · ") : "未设置标签"}</Text>
          </Stack>
          <Group gap={6} wrap="nowrap">
            <Button data-action="open-instance-settings" data-target={target.id} variant="subtle" size="compact-sm" onClick={() => onSettings(target.id)} disabled={busy}>设置</Button>
            <Button data-action="edit-target" data-target={target.id} variant="subtle" size="compact-sm" onClick={() => onEdit(target.id)} loading={loadingId === target.id} disabled={busy}>编辑</Button>
            <Button color="red" variant="subtle" size="compact-sm" onClick={() => setPendingDelete(target.id)} disabled={busy}>删除</Button>
          </Group>
        </Group>
      </Card>)}
      {pendingDelete && <Card withBorder padding="sm" className="management-danger-card"><Text fw={600}>确认删除实例配置？</Text><Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setPendingDelete(null)}>取消</Button><Button color="red" onClick={() => void remove()} loading={mutating}>确认删除</Button></Group></Card>}
    </Stack>
  );
}

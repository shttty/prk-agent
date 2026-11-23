import { useState } from "react";
import { runDialogAction } from "../../sessions/dialogs/run-dialog-action.js";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { FormError } from "../../design-system/form-error/FormError.jsx";
import { Text } from "@mantine/core";
import { Card } from "@mantine/core";
import { labelForTarget } from "../../sessions/sidebar/labels/label-for-target.js";
import { LocalBadge } from "../../sessions/sidebar/LocalBadge.jsx";
import { ConfigurationIssueBadge } from "../configuration-issue/ConfigurationIssueBadge.jsx";
import "./list.css";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
export function TargetList({ actions, onEdit, onAdd, onSettings, loadingId }) {
  const targets = useWorkbench((state) => state.targets);
  const reloading = useWorkbench((state) => state.pending.has("reloadingTargets"));
  const mutating = useWorkbench((state) => state.pending.has("targetMutating"));
  const sessionError = useWorkbench((state) => state.session.error);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [error, setError] = useState("");
  async function remove() {
    if (!pendingDelete) return;
    setError("");
    await runDialogAction(() => actions.deleteTarget(pendingDelete), () => setPendingDelete(null), setError, "实例删除失败。 ", "实例删除失败。 ");
  }
  return (
    <Stack gap="md">
      <Group justify="space-between"><Button id="add-target" onClick={onAdd}>添加实例</Button><Button variant="default" onClick={() => actions.reloadTargets()} loading={reloading || mutating}>刷新配置</Button></Group>
      <FormError>{error || sessionError}</FormError>
      {!targets.length && <Text size="sm" c="dimmed">暂无服务端实例配置。</Text>}
      {targets.map((target) => <Card key={target.id} withBorder padding="sm">
        <Group justify="space-between" wrap="nowrap" className="management-target-row">
          <div className="management-target-copy"><Text size="sm" fw={500}>{labelForTarget(target)}{target.local === true && <LocalBadge />} <ConfigurationIssueBadge issue={target.configurationIssue} onOpen={() => onEdit(target.id)} /></Text><Text size="xs" c="dimmed">{target.tags?.length ? target.tags.join(" · ") : "未设置标签"}</Text></div>
          <Group gap={6} wrap="nowrap"><Button data-action="open-instance-settings" data-target={target.id} variant="subtle" size="compact-sm" onClick={() => onSettings(target.id)} disabled={Boolean(mutating || loadingId)}>设置</Button><Button data-action="edit-target" data-target={target.id} variant="subtle" size="compact-sm" onClick={() => onEdit(target.id)} loading={loadingId === target.id} disabled={Boolean(mutating || loadingId)}>编辑</Button><Button color="red" variant="subtle" size="compact-sm" onClick={() => setPendingDelete(target.id)} disabled={Boolean(mutating || loadingId)}>删除</Button></Group>
        </Group>
      </Card>)}
      {pendingDelete && <Card withBorder padding="sm" className="management-danger-card"><Text fw={600}>确认删除实例配置？</Text><Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setPendingDelete(null)}>取消</Button><Button color="red" onClick={remove} loading={mutating}>确认删除</Button></Group></Card>}
    </Stack>
  );
}

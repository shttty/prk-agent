import { useState } from "react";
import { ActionIcon } from "@mantine/core";
import { Menu } from "@mantine/core";
import { Modal } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { IconDots } from "@tabler/icons-react";
import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import type { OpenDialog, SessionGroup } from "./sidebar-types.ts";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { runDialogAction } from "../dialogs/run-dialog-action.ts";
import { FormError } from "../../design-system/form-error/FormError.tsx";
import { ConfigurationIssueBadge } from "../../instances/configuration-issue/ConfigurationIssueBadge.tsx";
import type { WorkbenchReads } from "../workbench-reads-types.ts";
/** `+` (new session on this instance) and `…` (settings / delete) of an instance group header, with the delete confirmation. */
type InstanceGroupActionsProps = { group: SessionGroup; actions: WorkbenchActions; creating: boolean; onOpen: OpenDialog };

export function InstanceGroupActions({ group, actions, creating, onOpen }: InstanceGroupActionsProps) {
  const targetMutating = useWorkbench((state: WorkbenchReads) => state.pending.has("targetMutating"));
  const [pendingDelete, setPendingDelete] = useState<PublicExecutionTarget | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const closeDelete = () => { setPendingDelete(null); setDeleteError(""); };
  const removeInstance = () => pendingDelete && runDialogAction(() => actions.deleteTarget(pendingDelete.id), closeDelete, setDeleteError, "实例删除失败。", "实例删除失败。");
  const { target } = group;
  if (!target) return null;
  return <>
    <ConfigurationIssueBadge issue={target.configurationIssue} onOpen={() => onOpen("instance", target.id)} />
    <ActionIcon className="management-group-add" data-action="create-session" data-target={target.id} variant="subtle" color="gray" size="md" aria-label={`在${group.name}新建会话`} title={`在${group.name}新建会话`} disabled={creating} onClick={() => onOpen("create", target.id)}><IconPlus size={15} /></ActionIcon>
    <Menu position="bottom-end" withinPortal>
      <Menu.Target><ActionIcon className="management-group-menu" data-action="instance-menu" data-target={target.id} variant="subtle" color="gray" size="md" aria-label={`${group.name}的实例设置`}><IconDots size={15} /></ActionIcon></Menu.Target>
      <Menu.Dropdown>
        <Menu.Item data-action="instance-settings" data-target={target.id} onClick={() => onOpen("instance", target.id)}>设置</Menu.Item>
        <Menu.Item data-action="delete-instance" data-target={target.id} color="red" disabled={targetMutating} onClick={() => setPendingDelete(target)}>删除实例</Menu.Item>
      </Menu.Dropdown>
    </Menu>
    <Modal id="delete-instance-confirm" opened={Boolean(pendingDelete)} onClose={closeDelete} title="删除实例" centered size={380}>
      <Stack gap="md">
        <Text>{pendingDelete?.label}</Text>
        <FormError>{deleteError}</FormError>
        <Group justify="flex-end"><Button data-action="cancel-delete-instance" variant="default" onClick={closeDelete}>取消</Button><Button data-action="confirm-delete-instance" color="red" loading={targetMutating} onClick={() => void removeInstance()}>删除</Button></Group>
      </Stack>
    </Modal>
  </>;
}

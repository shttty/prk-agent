import { Modal } from "@mantine/core";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import type { CloseConfirm } from "../session-workspace/workspace-types.ts";
import { baseName } from "../file-paths/base-name.ts";

/** Closing a tab with unsaved text asks first. `confirm`: `{ id, path }` or null. */
type ConfirmCloseDialogProps = { confirm: CloseConfirm | null; onCancel: () => void; onDiscard: (id: string) => void };

export function ConfirmCloseDialog({ confirm, onCancel, onDiscard }: ConfirmCloseDialogProps) {
  return <Modal id="confirm-close-dialog" opened={Boolean(confirm)} onClose={onCancel} title={confirm ? `关闭 ${baseName(confirm.path)}？` : ""} size="sm" centered>
    <Text size="sm">有未保存的修改。</Text>
    <Group justify="flex-end" gap="xs" mt="md">
      <Button variant="default" data-action="cancel" onClick={onCancel}>取消</Button>
      <Button id="confirm-close-discard" color="red" onClick={() => { if (confirm) onDiscard(confirm.id); }}>丢弃并关闭</Button>
    </Group>
  </Modal>;
}

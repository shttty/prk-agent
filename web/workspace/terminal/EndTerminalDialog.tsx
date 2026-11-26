import { Modal } from "@mantine/core";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";

type EndTerminalDialogProps = { ending: string | null; error: string; busy: boolean; noCleanupAfterDisconnect?: boolean; onCancel: () => void; onConfirm: () => void };

/** Closing a shell asks first. `ending`: the shell's name or null. The text promises nothing about what survives the close.
 * `noCleanupAfterDisconnect`: the target reported `cleanup:"normal-close-only"` (no Linux parent-death signal there). */
export function EndTerminalDialog({ ending, error, busy, noCleanupAfterDisconnect = false, onCancel, onConfirm }: EndTerminalDialogProps) {
  return <Modal id="end-terminal-dialog" opened={Boolean(ending)} onClose={onCancel} title={ending ? "关闭此终端？" : ""} size="sm" centered>
    <Text size="sm">未完成的命令可能中断。</Text>
    {noCleanupAfterDisconnect ? <Text size="sm" c="dimmed" data-cleanup="normal-close-only">此目标不保证连接断开后清理进程。</Text> : null}
    {error ? <InlineAlert mt="xs">{error}</InlineAlert> : null}
    <Group justify="flex-end" gap="xs" mt="md">
      <Button variant="default" data-action="cancel" onClick={onCancel}>取消</Button>
      <Button id="confirm-end-terminal" color="red" loading={busy} onClick={onConfirm}>关闭</Button>
    </Group>
  </Modal>;
}

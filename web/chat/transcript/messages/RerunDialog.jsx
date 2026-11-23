import { useEffect } from "react";
import { useState } from "react";
import { Modal } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
export const RERUN_LABELS = { retry: "退回并重发", edit: "改了重发" };

/**
 * Asks where 从这里重来 / 改了重发 should happen: back up this session (default) or fork a new one. MessageActions mounts
 * it on first use; it opens one render after mounting because Mantine records the element to return focus to only
 * when `opened` changes.
 */
export function RerunDialog({ request, onClose, onConfirm }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const mode = request?.mode;
  const canFork = Boolean(request?.canFork);
  const action = mode === "edit" ? "将这条消息放回输入框，修改后发送" : "原样重新发送这条消息";
  return <Modal opened={mounted && Boolean(request)} onClose={onClose} title={RERUN_LABELS[mode] || ""} centered size={440}>
    <Stack gap="sm" className="pi-rerun-dialog">
      <Text size="sm">退回到这条消息之前，然后{action}。在哪里进行？</Text>
      <Text id="kernel-rollback-warning" size="xs" c="dimmed">kernel 状态不随对话回退。</Text>
      <Group justify="flex-end" gap="xs" mt="xs">
        <Button data-action="cancel" variant="default" onClick={onClose}>取消</Button>
        <Button data-action="fork" variant="default" disabled={!canFork} title={canFork ? undefined : "前面没有回复，无法分叉"} onClick={() => onConfirm("new")}>分叉到新会话</Button>
        <Button data-action="current" data-autofocus onClick={() => onConfirm("here")}>在当前会话里</Button>
      </Group>
    </Stack>
  </Modal>;
}

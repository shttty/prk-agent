import type { useGatewayRestart } from "./use-gateway-restart.ts";
import { Button } from "@mantine/core";
import { Text } from "@mantine/core";
import { Modal } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
/** Confirmation for `useGatewayRestart`; content renders only while open, so every entry can mount its own copy. */
export function GatewayRestartDialog({ restart }: { restart: ReturnType<typeof useGatewayRestart> }) {
  const { confirming, setConfirming } = restart;
  return <Modal id="gateway-restart-dialog" opened={confirming} onClose={() => setConfirming(false)} title="重启 Gateway" centered size="sm">
    <Stack gap="md">
      <Stack gap={4}>
        <Text size="sm">所有会话正在进行的回复会中断，结果未知，不会重放。</Text>
        <Text size="sm">Gateway 正常停止时会关闭 kernel 和模型终端（Python 变量丢失），人工终端和文件保留；卡死被强制结束时 kernel 保留。</Text>
        <Text size="sm">页面会自动重连。</Text>
      </Stack>
      <Group justify="flex-end">
        <Button id="gateway-restart-cancel" variant="default" onClick={() => setConfirming(false)}>取消</Button>
        <Button id="gateway-restart-confirm" color="red" onClick={() => void restart.restart()}>重启</Button>
      </Group>
    </Stack>
  </Modal>;
}

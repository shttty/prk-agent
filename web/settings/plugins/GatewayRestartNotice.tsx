import type { PageApi } from "../../shell/page/page-types.ts";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { useGatewayRestart } from "../gateway-restart/use-gateway-restart.ts";
import { ERROR_TEXT } from "../gateway-restart/use-gateway-restart.ts";
import { GatewayRestartDialog } from "../gateway-restart/GatewayRestartDialog.tsx";
/** `PluginList.restartRequired`: saved provider-owner changes wait for a Gateway restart (models keep the running
 * bootstrap until then). The entry is the 通用 settings restart flow itself; `unit` is `GET /api/ui` gatewayRestartUnit. */
export function GatewayRestartNotice({ unit, api }: { unit: string | null | undefined; api: PageApi }) {
  const restart = useGatewayRestart(api);
  const { phase, setConfirming } = restart;
  const configured = Boolean(unit);
  const status = !configured ? "unconfigured" : phase.status === "idle" ? "required" : phase.status;
  return <InlineAlert id="plugin-restart-notice" data-status={status} color="gray" size="sm" role="status">
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="sm">{phase.status === "done" ? "Gateway 已重启。" : "需重启 Gateway 生效。"}</Text>
      {phase.status !== "done" ? <Button data-action="gateway-restart" size="compact-sm" variant="default" color="red" loading={phase.status === "running"} disabled={!configured} onClick={() => setConfirming(true)}>重启 Gateway</Button> : null}
    </Group>
    {!configured ? <Text size="xs" c="dimmed" mt={4}>{ERROR_TEXT.NOT_CONFIGURED}</Text> : null}
    {phase.status === "failed" ? <Text size="xs" c="red" mt={4} role="alert">{phase.message}</Text> : null}
    <GatewayRestartDialog restart={restart} />
  </InlineAlert>;
}

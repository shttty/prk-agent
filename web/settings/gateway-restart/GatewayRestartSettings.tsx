import type { PageApi } from "../../shell/page/page-types.ts";
import { IconRefresh } from "@tabler/icons-react";
import { Badge } from "@mantine/core";
import { Button } from "@mantine/core";
import { Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { useGatewayRestart } from "./use-gateway-restart.ts";
import { ERROR_TEXT } from "./use-gateway-restart.ts";
import { GatewayRestartDialog } from "./GatewayRestartDialog.tsx";

/**
 * Settings → 通用 → Gateway. `unit` comes from `GET /api/ui` (`gatewayRestartUnit`); the API process runs
 * `systemctl --user restart` itself, so this works while the Gateway is frozen. After the Gateway comes back the page
 * recovers through the usual connection banner and stream identity handling; nothing here reconnects.
 */
export default function GatewayRestartSettings({ unit, api }: { unit: string | null | undefined; api: PageApi }) {
  const restart = useGatewayRestart(api);
  const { phase, setConfirming } = restart;
  const configured = Boolean(unit);
  const running = phase.status === "running";
  return <section className="settings-section" data-section="gateway">
    <h3 className="pi-settings-heading">Gateway</h3>
    <div className="pi-settings-group"><div className="pi-settings-row is-static">
      <span className="pi-settings-icon" aria-hidden="true"><IconRefresh size={16} stroke={1.7} /></span>
      <span className="pi-settings-title">重启 Gateway</span>
      {phase.status === "done" ? <Badge id="gateway-restart-status" data-status="done" role="status" component="span" variant="light" color="green" size="sm" tt="none">已重启</Badge> : null}
      <Button id="gateway-restart" size="xs" variant="default" color="red" loading={running} disabled={!configured} data-status={phase.status} onClick={() => setConfirming(true)}>重启</Button>
    </div></div>
    {!configured ? <Text id="gateway-restart-note" data-status="unconfigured" size="xs" c="dimmed">{ERROR_TEXT.NOT_CONFIGURED}</Text> : null}
    {phase.status === "failed" ? <InlineAlert id="gateway-restart-status" data-status="failed" role="alert" size="xs">{phase.message}</InlineAlert> : null}
    <GatewayRestartDialog restart={restart} />
  </section>;
}

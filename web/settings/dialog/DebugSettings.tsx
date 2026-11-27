import type { PageApi } from "../../shell/page/page-types.ts";
import { useEffect, useState } from "react";
import { IconActivity, IconNetwork } from "@tabler/icons-react";
import { NumberInput, Text, TextInput } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import { DebugModeSetting } from "./DebugModeSetting.tsx";
import { useMetricsSettings } from "./use-metrics-settings.ts";

const label = "Gateway 指标";
// The Gateway rejects anything else too; this keeps the hint next to the field.
const PORT_RANGE = { min: 1024, max: 65_535 };

/** Settings → 通用 → 调试: the browser-only debug mode, and the Gateway's metrics endpoint (global config, applied at once). */
export function DebugSettings({ api }: { api: PageApi }) {
  const { view, failure, setFailure, saving, save } = useMetricsSettings(api);
  const [draft, setDraft] = useState<number | string>("");
  const [host, setHost] = useState("");
  useEffect(() => { if (view) { setDraft(view.port); setHost(view.host); } }, [view]);

  const commitPort = () => {
    if (!view || saving || draft === view.port) return;
    if (typeof draft !== "number" || !Number.isInteger(draft) || draft < PORT_RANGE.min || draft > PORT_RANGE.max) {
      setFailure(`端口需为 ${PORT_RANGE.min}–${PORT_RANGE.max} 的整数。`);
      setDraft(view.port);
      return;
    }
    void save({ enabled: view.enabled, host: view.host, port: draft }).then((applied) => { if (!applied) setDraft(view.port); });
  };

  // The Gateway checks that it is an IP literal.
  const commitHost = () => {
    if (!view || saving || host.trim() === view.host) return;
    void save({ enabled: view.enabled, host: host.trim(), port: view.port }).then((applied) => { if (!applied) setHost(view.host); });
  };

  const error = failure || view?.error || "";
  return <section className="settings-section" data-section="debug">
    <h3 className="pi-settings-heading">调试</h3>
    <div className="pi-settings-group">
      <DebugModeSetting />
      <div className="pi-settings-row is-static">
        <span className="pi-settings-icon" aria-hidden="true"><IconActivity size={16} stroke={1.7} /></span>
        <label className="pi-settings-title" htmlFor="setting-metrics-enabled">{label}</label>
        <NumberInput id="setting-metrics-port" aria-label="指标端口" size="xs" w={72} hideControls allowDecimal={false} allowNegative={false}
          value={draft} disabled={!view || saving} onChange={setDraft} onBlur={commitPort} onKeyDown={(event) => { if (event.key === "Enter") commitPort(); }} />
        <PrkSwitch id="setting-metrics-enabled" checked={view?.enabled === true} disabled={!view || saving}
          onChange={(event) => { if (view) void save({ enabled: event.currentTarget.checked, host: view.host, port: view.port }); }} />
      </div>
      <div className="pi-settings-row is-static">
        <span className="pi-settings-icon" aria-hidden="true"><IconNetwork size={16} stroke={1.7} /></span>
        <label className="pi-settings-title" htmlFor="setting-metrics-host">监听地址</label>
        <TextInput id="setting-metrics-host" aria-label="指标地址" size="xs" w={150} spellCheck={false} value={host} disabled={!view || saving}
          onChange={(event) => setHost(event.currentTarget.value)} onBlur={commitHost} onKeyDown={(event) => { if (event.key === "Enter") commitHost(); }} />
      </div>
    </div>
    {view?.url ? <Text id="metrics-url" size="xs" c="dimmed" className="pi-settings-copyable">{view.url}</Text> : null}
    {error ? <InlineAlert id="metrics-error" role="alert" size="xs">{error}</InlineAlert> : null}
  </section>;
}

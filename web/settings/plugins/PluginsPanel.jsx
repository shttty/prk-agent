import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Button } from "@mantine/core";
import { Loader } from "@mantine/core";
import { Modal } from "@mantine/core";
import { Text } from "@mantine/core";
import { NativeSelect } from "@mantine/core";
import { PluginRow } from "./PluginRow.jsx";
import { PluginFailure } from "./PluginFailure.jsx";
import { GatewayRestartNotice } from "./GatewayRestartNotice.jsx";
import { PLUGIN_LOCATIONS } from "./plugin-locations.js";
import { DEFAULT_PLUGIN_LOCATION } from "./plugin-locations.js";
import "./plugins.css";
/** The one plugin list (`/api/plugins`, docs/wire/plugin-config.md#pi-packages): Pi packages from npm or a Gateway
 * directory, each enabled or not and placed on the session host or the Gateway. Saved changes apply to new, woken or
 * reloaded sessions; provider-owner changes apply after a Gateway restart (`restartRequired`, shown even with an empty
 * list). A rejected change shows on its row; the list keeps the Gateway's last answer. */
export default function PluginsPanel({ actions, gatewayRestartUnit }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState(null);
  const [source, setSource] = useState("");
  const [location, setLocation] = useState(DEFAULT_PLUGIN_LOCATION);
  const [removal, setRemoval] = useState(null);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setData(null); setBusy(true); setFailure(null);
    actions.api.get("/plugins").then((result) => {
      if (current === generation.current) setData(result);
    }).catch((cause) => {
      if (current === generation.current) setFailure({ source: null, message: cause.message, code: cause.code, details: cause.details });
    }).finally(() => { if (current === generation.current) setBusy(false); });
    return () => { generation.current = current + 1; };
  }, [actions]);

  const mutate = async (failureSource, path, payload, after) => {
    const current = generation.current;
    setBusy(true); setFailure(null);
    try {
      const result = await actions.api.post(path, payload);
      if (current !== generation.current) return;
      setData(result); after?.();
    } catch (cause) {
      if (current === generation.current) setFailure({ source: failureSource, message: cause.message, code: cause.code, details: cause.details });
    } finally { if (current === generation.current) setBusy(false); }
  };
  const install = (event) => {
    event.preventDefault();
    void mutate(null, "/plugins/install", { source: source.trim(), location }, () => { setSource(""); setLocation(DEFAULT_PLUGIN_LOCATION); });
  };
  const uninstall = () => void mutate(removal.source, "/plugins/uninstall", { source: removal.source, confirm: true }, () => setRemoval(null));
  const formFailure = failure && failure.source === null ? failure : null;
  const removalFailure = removal && failure?.source === removal.source ? failure : null;

  return <Stack id="plugins-manager" gap="lg" aria-busy={busy}>
    <form id="plugin-install-form" onSubmit={install}>
      <Group align="end" gap="xs" className="plugin-install-row">
        <TextInput id="plugin-source" className="plugin-source" label="安装插件" placeholder="npm 包名或 Gateway 上的目录绝对路径" value={source} onChange={(event) => setSource(event.currentTarget.value)} disabled={busy} required />
        <NativeSelect id="plugin-install-location" className="plugin-install-location" aria-label="安装位置" data={PLUGIN_LOCATIONS} value={location} disabled={busy} onChange={(event) => setLocation(event.currentTarget.value)} />
        <Button id="plugin-install" type="submit" size="sm" loading={busy && Boolean(data)} disabled={busy || !source.trim()}>安装</Button>
      </Group>
    </form>
    {formFailure ? <PluginFailure id="plugin-error" failure={formFailure} /> : null}
    {data?.restartRequired ? <GatewayRestartNotice unit={gatewayRestartUnit} api={actions.api} /> : null}
    {!data && busy ? <Loader size="sm" /> : null}
    {data && !data.packages.length ? <Text id="plugins-empty" c="dimmed" size="sm">暂无插件。</Text> : null}
    <div className="plugin-list" data-count={data?.packages.length}>
      {(data?.packages ?? []).map((pkg) => <PluginRow key={pkg.source} pkg={pkg} busy={busy}
        failure={!removal && failure?.source === pkg.source ? failure : null}
        onChange={(patch) => void mutate(pkg.source, "/plugins/change", { source: pkg.source, ...patch })}
        onUninstall={() => { setFailure(null); setRemoval(pkg); }} />)}
    </div>
    <Modal id="plugin-uninstall-dialog" opened={Boolean(removal)} onClose={() => { if (!busy) setRemoval(null); }} title="卸载插件" centered size="sm">
      <Stack gap="md">
        <Text size="sm" className="plugin-uninstall-name">{removal?.name}<br /><code>{removal?.source}</code></Text>
        {removalFailure ? <PluginFailure failure={removalFailure} /> : null}
        <Group justify="flex-end">
          <Button id="plugin-cancel-uninstall" variant="default" disabled={busy} onClick={() => setRemoval(null)}>取消</Button>
          <Button id="plugin-confirm-uninstall" color="red" loading={busy} onClick={uninstall}>卸载</Button>
        </Group>
      </Stack>
    </Modal>
  </Stack>;
}

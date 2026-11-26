import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Modal } from "@mantine/core";
import { Text } from "@mantine/core";
import { SplitPage } from "../list-page/SplitPage.jsx";
import { PluginList } from "./PluginList.jsx";
import { PluginDetail } from "./PluginDetail.jsx";
import { PluginFailure } from "./PluginFailure.jsx";
import { GatewayRestartNotice } from "./GatewayRestartNotice.jsx";
import { isConnectionFailure } from "../../workbench/store/requests/is-connection-failure.js";
import { useRelink } from "../list-page/use-relink.js";
import "./plugins.css";

/** Tool groups a plugin package provides in the capability catalog: `group:tools:package:<name>` and its remote twins. */
function pluginToolGroups(catalog, name) {
  const groups = (catalog?.groups ?? []).filter((group) => group.kind === "tool" && group.id.endsWith(`:${name}`) && (group.id.includes(":package:") || group.id.includes(":remote:")));
  const ids = new Set(groups.map((group) => group.id));
  return { groupId: groups[0]?.id, count: (catalog?.entries ?? []).filter((entry) => entry.kind === "tool" && ids.has(entry.group)).length };
}

/** The one plugin list (`/api/plugins`, docs/wire/plugin-config.md#pi-packages): Pi packages from npm or a Gateway
 * directory, each enabled or not and placed on the session host or the Gateway. Saved changes apply to new, woken or
 * reloaded sessions; provider-owner changes apply after a Gateway restart (`restartRequired`, shown even with an empty
 * list). A rejected change shows on its package; the list keeps the Gateway's last answer. Tool counts come from the
 * capability catalog (`/api/capabilities`). */
export default function PluginsPanel({ actions, gatewayRestartUnit, mobile, onOpenTools }) {
  const [data, setData] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState(null);
  const [removal, setRemoval] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useRelink(() => setAttempt((value) => value + 1), waiting);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setData(null); setBusy(true); setFailure(null);
    actions.api.get("/plugins").then((result) => {
      if (current === generation.current) { setData(result); setWaiting(false); }
    }).catch((cause) => {
      if (current !== generation.current) return;
      if (isConnectionFailure(cause)) setWaiting(true);
      else setFailure({ source: null, message: cause.message, code: cause.code, details: cause.details });
    }).finally(() => { if (current === generation.current) setBusy(false); });
    actions.api.get("/capabilities").then((result) => { if (current === generation.current) setCatalog(result.catalog); }).catch(() => {});
    return () => { generation.current = current + 1; };
  }, [actions, attempt]);

  const mutate = async (failureSource, path, payload, after) => {
    const current = generation.current;
    setBusy(true); setFailure(null);
    try {
      const result = await actions.api.post(path, payload);
      if (current !== generation.current) return;
      setData(result); after?.();
    } catch (cause) {
      if (current === generation.current && !isConnectionFailure(cause)) setFailure({ source: failureSource, message: cause.message, code: cause.code, details: cause.details });
    } finally { if (current === generation.current) setBusy(false); }
  };
  const install = (source, location) => void mutate(null, "/plugins/install", { source, location }, () => setInstalling(false));
  const uninstall = () => void mutate(removal.source, "/plugins/uninstall", { source: removal.source, confirm: true }, () => { setRemoval(null); setSheetOpen(false); });
  const packages = data?.packages ?? [];
  const active = packages.find((pkg) => pkg.source === selected) ?? packages[0];
  const choose = (source) => { setSelected(source); if (mobile) setSheetOpen(true); };
  const removalFailure = removal && failure?.source === removal.source ? failure : null;
  const detail = (back) => active ? <PluginDetail key={active.source} pkg={active} busy={busy} onBack={back}
    failure={!removal && failure?.source === active.source ? failure : null} tools={pluginToolGroups(catalog, active.name)} onOpenTools={onOpenTools}
    onChange={(patch) => void mutate(active.source, "/plugins/change", { source: active.source, ...patch })}
    onUninstall={() => { setFailure(null); setRemoval(active); }} /> : null;

  return <>
    <SplitPage id="plugins-manager" mobile={mobile} aria-busy={busy} sheetOpen={sheetOpen} onCloseSheet={() => setSheetOpen(false)} sheetId="plugin-sheet" backAction="close-plugin" detail={detail}
      list={<PluginList data={data} busy={busy} waiting={waiting} active={active?.source} mobile={mobile} installing={installing} setInstalling={setInstalling} onInstall={install} onChoose={choose}
        formFailure={failure && failure.source === null ? failure : null} restartNotice={data?.restartRequired ? <GatewayRestartNotice unit={gatewayRestartUnit} api={actions.api} /> : null} />} />
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
  </>;
}

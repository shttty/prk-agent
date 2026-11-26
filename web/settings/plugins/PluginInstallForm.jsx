import { useState } from "react";
import { Group } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { NativeSelect } from "@mantine/core";
import { Button } from "@mantine/core";
import { PLUGIN_LOCATIONS } from "./plugin-locations.js";
import { DEFAULT_PLUGIN_LOCATION } from "./plugin-locations.js";

/** Install form folded open at the top of the plugin list: source, location, install. */
export function PluginInstallForm({ busy, onInstall, onCancel }) {
  const [source, setSource] = useState("");
  const [location, setLocation] = useState(DEFAULT_PLUGIN_LOCATION);
  const submit = (event) => { event.preventDefault(); onInstall(source.trim(), location); };
  return <form id="plugin-install-form" className="plugin-install" onSubmit={submit}>
    <TextInput id="plugin-source" size="xs" aria-label="插件来源" placeholder="npm 包名或 Gateway 上的目录绝对路径" value={source} onChange={(event) => setSource(event.currentTarget.value)} disabled={busy} autoFocus />
    <Group gap="xs" wrap="nowrap">
      <NativeSelect id="plugin-install-location" size="xs" aria-label="安装位置" data={PLUGIN_LOCATIONS} value={location} disabled={busy} onChange={(event) => setLocation(event.currentTarget.value)} />
      <Button variant="default" size="xs" disabled={busy} onClick={onCancel}>取消</Button>
      <Button id="plugin-install" type="submit" size="xs" loading={busy} disabled={busy || !source.trim()}>安装</Button>
    </Group>
  </form>;
}

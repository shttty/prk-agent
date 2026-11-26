import type { FormEvent, ReactNode } from "react";
import type { PluginList as PluginListData, PluginLocation, PluginRejection } from "./plugin-types.ts";
import { Button } from "@mantine/core";
import { Loader } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { ListRow } from "../list-page/ListRow.tsx";
import { LinkWait } from "../list-page/LinkWait.tsx";
import { useState } from "react";
import { Group } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { NativeSelect } from "@mantine/core";
import { DEFAULT_PLUGIN_LOCATION } from "./plugin-locations.ts";
import { PluginFailure } from "./PluginFailure.tsx";
import { PLUGIN_LOCATIONS } from "./plugin-locations.ts";


/** Install form folded open at the top of the plugin list: source, location, install. */
function PluginInstallForm({ busy, onInstall, onCancel }: { busy: boolean; onInstall: (source: string, location: PluginLocation) => void; onCancel: () => void }) {
  const [source, setSource] = useState("");
  const [location, setLocation] = useState<PluginLocation>(DEFAULT_PLUGIN_LOCATION);
  const submit = (event: FormEvent) => { event.preventDefault(); onInstall(source.trim(), location); };
  return <form id="plugin-install-form" className="plugin-install" onSubmit={submit}>
    <TextInput id="plugin-source" size="xs" aria-label="插件来源" placeholder="npm 包名或 Gateway 上的目录绝对路径" value={source} onChange={(event) => setSource(event.currentTarget.value)} disabled={busy} autoFocus />
    <Group gap="xs" wrap="nowrap">
      <NativeSelect id="plugin-install-location" size="xs" aria-label="安装位置" data={PLUGIN_LOCATIONS} value={location} disabled={busy} onChange={(event) => setLocation(event.currentTarget.value === "host" ? "host" : "gateway")} />
      <Button variant="default" size="xs" disabled={busy} onClick={onCancel}>取消</Button>
      <Button id="plugin-install" type="submit" size="xs" loading={busy} disabled={busy || !source.trim()}>安装</Button>
    </Group>
  </form>;
}

const placeLabel = (location: string) => PLUGIN_LOCATIONS.find((item) => item.value === location)?.label ?? location;

/** Plugin column: 安装插件 (folds the form open), one row per package with version · location · state, the total. */
type PluginListProps = {
  data: PluginListData | null; unloaded: ReadonlySet<string>; busy: boolean; waiting: boolean; active: string | undefined; mobile: boolean; installing: boolean; setInstalling: (installing: boolean) => void;
  onInstall: (source: string, location: PluginLocation) => void; formFailure: PluginRejection | null; restartNotice: ReactNode; onChoose: (source: string) => void;
};

export function PluginList({ data, unloaded, busy, waiting, active, mobile, installing, setInstalling, onInstall, formFailure, restartNotice, onChoose }: PluginListProps) {
  const packages = data?.packages ?? [];
  return <section className="settings-list plugin-list">
    <div className="settings-list-top">
      {installing ? <PluginInstallForm busy={busy} onInstall={onInstall} onCancel={() => setInstalling(false)} />
        : <Button id="plugin-install-open" variant="subtle" color="gray" size="xs" leftSection={<IconPlus size={14} />} onClick={() => setInstalling(true)}>安装插件</Button>}
    </div>
    {formFailure ? <div className="plugin-list-notice"><PluginFailure id="plugin-error" failure={formFailure} /></div> : null}
    {restartNotice ? <div className="plugin-list-notice">{restartNotice}</div> : null}
    <div className="settings-list-scroll" id="plugin-sources" role="listbox" aria-label="插件" data-count={data?.packages.length}>
      {!data && busy ? <Loader size="sm" color="gray" /> : null}
      {!data && waiting ? <LinkWait /> : null}
      {data && !packages.length ? <Text id="plugins-empty" c="dimmed" size="sm" px="xs">暂无插件。</Text> : null}
      {packages.map((pkg) => <ListRow key={pkg.source} data-plugin-source={pkg.source} data-name={pkg.name} data-enabled={String(pkg.enabled)} data-location={pkg.location}
        selected={!mobile && active === pkg.source} onChoose={() => onChoose(pkg.source)} name={pkg.name}
        meta={[pkg.version, placeLabel(pkg.location), pkg.enabled ? "已启用" : "已停用", pkg.enabled && unloaded.has(pkg.source) ? "默认不加载" : ""].filter(Boolean).join(" · ")} />)}
    </div>
    {data ? <div className="settings-list-foot">{packages.length} 个插件</div> : null}
  </section>;
}

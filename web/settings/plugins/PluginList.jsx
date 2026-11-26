import { Button } from "@mantine/core";
import { Loader } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { ListRow } from "../list-page/ListRow.jsx";
import { LinkWait } from "../list-page/LinkWait.jsx";
import { PluginInstallForm } from "./PluginInstallForm.jsx";
import { PluginFailure } from "./PluginFailure.jsx";
import { PLUGIN_LOCATIONS } from "./plugin-locations.js";

const placeLabel = (location) => PLUGIN_LOCATIONS.find((item) => item.value === location)?.label ?? location;

/** Plugin column: 安装插件 (folds the form open), one row per package with version · location · state, the total. */
export function PluginList({ data, busy, waiting, active, mobile, installing, setInstalling, onInstall, formFailure, restartNotice, onChoose }) {
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
        meta={[pkg.version, placeLabel(pkg.location), pkg.enabled ? "已启用" : "已停用"].filter(Boolean).join(" · ")} />)}
    </div>
    {data ? <div className="settings-list-foot">{packages.length} 个插件</div> : null}
  </section>;
}

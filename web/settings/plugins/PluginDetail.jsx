import { Group } from "@mantine/core";
import { Badge } from "@mantine/core";
import { Anchor } from "@mantine/core";
import { NativeSelect } from "@mantine/core";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.jsx";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { ProviderPolicyAlert } from "../provider-policy/ProviderPolicyAlert.jsx";
import { DetailHeader } from "../list-page/DetailHeader.jsx";
import { DangerZone } from "../list-page/DangerZone.jsx";
import { PLUGIN_LOCATIONS } from "./plugin-locations.js";
import { PluginFailure } from "./PluginFailure.jsx";

/**
 * One installed Pi package: enable switch, location, the commands and providers it really registered, the tools it
 * provides (linking to the tools page), load/provider diagnostics, and uninstall at the bottom.
 * `failure` is this package's last rejected change; `tools` is `{groupId, count}` from the capability catalog.
 */
export function PluginDetail({ pkg, busy, failure, tools, onBack, onChange, onUninstall, onOpenTools }) {
  const source = `${({ local: "本地", npm: "npm", git: "git" })[pkg.sourceKind]} · ${pkg.sourceDisplay}`;
  return <div className="settings-detail plugin-detail" data-plugin-source={pkg.source} data-name={pkg.name} data-location={pkg.location} data-enabled={String(pkg.enabled)}
    data-command-count={pkg.commands.length} data-provider-count={pkg.providerIds.length}>
    <DetailHeader title={pkg.name} onBack={onBack} backAction="close-plugin" meta={<>{pkg.version ? <span data-plugin-version={pkg.version}>{pkg.version} · </span> : null}<span className="plugin-source-line" data-source-kind={pkg.sourceKind} title={pkg.source}>{source}</span></>}>
      <PrkSwitch data-action="plugin-enabled" checked={pkg.enabled} disabled={busy} aria-label={`启用 ${pkg.name}`} onChange={(event) => onChange({ enabled: event.currentTarget.checked })} />
    </DetailHeader>
    <div className="settings-detail-body">
      <Group gap="sm" align="center" className="plugin-field">
        <span className="plugin-field-label">位置</span>
        <NativeSelect data-action="plugin-location" size="xs" w={160} aria-label={`${pkg.name} 位置`} data={PLUGIN_LOCATIONS} value={pkg.location} disabled={busy} onChange={(event) => onChange({ location: event.currentTarget.value })} />
      </Group>
      <Group gap="sm" className="plugin-field" data-tool-count={tools.count}>
        <span className="plugin-field-label">工具</span>
        <span>{tools.count} 个</span>
        {tools.groupId && onOpenTools ? <Anchor component="button" type="button" size="sm" data-action="plugin-open-tools" onClick={() => onOpenTools(tools.groupId)}>在工具页查看</Anchor> : null}
      </Group>
      {pkg.providerIds.length ? <Group gap={6} className="plugin-field">
        <span className="plugin-field-label">Provider</span>
        {pkg.providerIds.map((id) => <Badge key={id} data-provider-id={id} size="sm" variant="light" color="gray" tt="none">{id}</Badge>)}
      </Group> : null}
      {pkg.commands.length ? <section className="plugin-commands">
        <span className="plugin-field-label">命令</span>
        <ul>{pkg.commands.map((command) => <li key={command.name} data-command={command.name}><code>/{command.name}</code>{command.description ? <span>{command.description}</span> : null}</li>)}</ul>
      </section> : null}
      {pkg.error !== undefined ? <PluginFailure data-kind="plugin-error" failure={{ message: pkg.error, code: pkg.errorCode, details: pkg.errorDetails }} /> : null}
      {pkg.providerErrors.map((item, index) => <ProviderPolicyAlert key={`${item.providerId}-${item.operation}-${index}`} item={item} />)}
      {pkg.warnings?.map((message) => <InlineAlert key={message} color="yellow" size="sm" title="启动警告" data-kind="plugin-warning">{message}</InlineAlert>)}
      {failure ? <PluginFailure data-kind="plugin-change-error" failure={failure} /> : null}
      <DangerZone label="卸载插件" description="从 Gateway 删除这个插件包。" action="plugin-uninstall" disabled={busy} onAction={onUninstall} />
    </div>
  </div>;
}

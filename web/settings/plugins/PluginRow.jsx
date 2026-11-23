import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Badge } from "@mantine/core";
import { NativeSelect } from "@mantine/core";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.jsx";
import { ProviderPolicyAlert } from "../provider-policy/ProviderPolicyAlert.jsx";
import { PLUGIN_LOCATIONS } from "./plugin-locations.js";
import { PluginFailure } from "./PluginFailure.jsx";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
/** One installed Pi package: location, enable switch, uninstall, the commands and providers it really registered, and
 * load/provider diagnostics (`error`/`errorCode`/`errorDetails`). `failure` is this row's last rejected change. */
export function PluginRow({ pkg, busy, failure, onChange, onUninstall }) {
  return <section className="plugin-row" data-plugin-source={pkg.source} data-name={pkg.name} data-location={pkg.location} data-enabled={String(pkg.enabled)} data-command-count={pkg.commands.length} data-provider-count={pkg.providerIds.length}>
    <header className="plugin-row-header">
      <div className="plugin-row-title">
        <h4>{pkg.name}{pkg.version ? <> <span className="plugin-row-version" data-plugin-version={pkg.version}>{pkg.version}</span></> : null}</h4>
        <code className="plugin-row-source" data-source-kind={pkg.sourceKind} title={pkg.source}>{({ local: "本地", npm: "npm", git: "git" })[pkg.sourceKind]} · {pkg.sourceDisplay}</code>
      </div>
      <PrkSwitch data-action="plugin-enabled" checked={pkg.enabled} disabled={busy} aria-label={`启用 ${pkg.name}`} onChange={(event) => onChange({ enabled: event.currentTarget.checked })} />
    </header>
    <Group gap="xs" justify="space-between" wrap="nowrap">
      <NativeSelect data-action="plugin-location" aria-label={`${pkg.name} 位置`} data={PLUGIN_LOCATIONS} value={pkg.location} disabled={busy} onChange={(event) => onChange({ location: event.currentTarget.value })} />
      <Button data-action="plugin-uninstall" size="compact-sm" variant="subtle" color="red" disabled={busy} onClick={onUninstall}>卸载</Button>
    </Group>
    {pkg.providerIds.length ? <Group gap={6} className="plugin-row-providers">
      {pkg.providerIds.map((id) => <Badge key={id} data-provider-id={id} size="sm" variant="light" color="gray" tt="none">provider · {id}</Badge>)}
    </Group> : null}
    {pkg.commands.length ? <ul className="plugin-row-commands">
      {pkg.commands.map((command) => <li key={command.name} data-command={command.name}><code>/{command.name}</code>{command.description ? <span>{command.description}</span> : null}</li>)}
    </ul> : null}
    {pkg.error !== undefined ? <PluginFailure data-kind="plugin-error" failure={{ message: pkg.error, code: pkg.errorCode, details: pkg.errorDetails }} /> : null}
    {pkg.providerErrors.map((item, index) => <ProviderPolicyAlert key={`${item.providerId}-${item.operation}-${index}`} item={item} />)}
    {pkg.warnings?.map((message) => <InlineAlert key={message} color="yellow" size="sm" title="启动警告" data-kind="plugin-warning">{message}</InlineAlert>)}
    {failure ? <PluginFailure data-kind="plugin-change-error" failure={failure} /> : null}
  </section>;
}

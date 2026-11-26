import type { CapabilityCatalog, CapabilityChange } from "../capabilities/capability-types.ts";
import { Text } from "@mantine/core";
import { PackageLoadSwitch } from "../plugins/PackageLoadSwitch.tsx";
import { PLUGIN_LOCATIONS } from "../plugins/plugin-locations.ts";
import { RoleRestoreButton } from "./RoleRestoreButton.tsx";

type RolePackageLoadListProps = { catalog: CapabilityCatalog | null; capabilities: Record<string, boolean>; disabled: boolean; onWrites: (writes: CapabilityChange[]) => void };

/** 插件 tab of the role panel: one 加载 switch per package; the role's own value sits over the global default. */
export function RolePackageLoadList({ catalog, capabilities, disabled, onWrites }: RolePackageLoadListProps) {
  const packages = catalog?.packages ?? [];
  if (!packages.length) return <Text size="sm" c="dimmed" py="sm">暂无可配置项</Text>;
  return <div className="subsession-capabilities-body" data-role-packages>
    <div className="capability-rows">
      {packages.map((pkg) => {
        const own = capabilities[pkg.load.id];
        return <div key={pkg.source} className="capability-row capability-line" data-package={pkg.source} data-enabled={String(own ?? pkg.load.enabled !== false)}>
          <div className="capability-copy">
            <div className="capability-copy-head"><span className="capability-name" data-name={pkg.name}>{pkg.name}</span></div>
            <div className="capability-summary">{PLUGIN_LOCATIONS.find((item) => item.value === pkg.location)?.label ?? pkg.location}{pkg.load.enabled === false ? " · 全局默认不加载" : ""}</div>
          </div>
          <span className="capability-pair">
            <RoleRestoreButton ids={own === undefined ? [] : [pkg.load.id]} capabilityId={pkg.load.id} disabled={disabled} onRestore={(ids) => onWrites(ids.map((id) => ({ id, enabled: null })))} />
            <PackageLoadSwitch pkg={pkg} checked={own ?? pkg.load.enabled !== false} disabled={disabled} onChange={(enabled) => onWrites([{ id: pkg.load.id, enabled }])} />
          </span>
        </div>;
      })}
    </div>
  </div>;
}

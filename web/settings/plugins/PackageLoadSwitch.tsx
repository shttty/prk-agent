import type { CapabilityPackage } from "../capabilities/capability-types.ts";
import { Tooltip } from "@mantine/core";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";

type PackageLoadSwitchProps = { pkg: CapabilityPackage; checked?: boolean; disabled?: boolean; onChange: (enabled: boolean) => void };

/** 加载: off keeps the whole package (tools, hooks, commands, skills) out of the sessions this layer covers. A package that owns Gateway providers stays on. */
export function PackageLoadSwitch({ pkg, checked = pkg.load.enabled !== false, disabled = false, onChange }: PackageLoadSwitchProps) {
  const provider = pkg.providerIds.length > 0;
  return <Tooltip label={`提供 Provider ${pkg.providerIds.join("、")}，由 Gateway 统一加载，只能用「启用」开关停用。`} disabled={!provider}>
    <span><PrkSwitch data-action="package-load" data-package={pkg.source} aria-label={`加载 ${pkg.name}`} checked={checked || provider} disabled={disabled || provider} onChange={(event) => onChange(event.currentTarget.checked)} /></span>
  </Tooltip>;
}

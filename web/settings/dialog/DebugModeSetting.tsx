import { IconBug } from "@tabler/icons-react";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import { useDebugModePreference } from "../../workspace/debug-tools/use-debug-mode-preference.ts";

export function DebugModeSetting() {
  const [enabled, setEnabled] = useDebugModePreference();
  return <div className="pi-settings-row is-static">
    <span className="pi-settings-icon" aria-hidden="true"><IconBug size={16} stroke={1.7} /></span>
    <label className="pi-settings-title" htmlFor="setting-debug-mode">调试模式</label>
    <PrkSwitch id="setting-debug-mode" checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} />
  </div>;
}

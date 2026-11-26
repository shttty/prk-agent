import { IconPlayerPause } from "@tabler/icons-react";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import { useNoAnimationPreference } from "../../design-system/motion/use-no-animation-preference.ts";

export function NoAnimationSetting() {
  const [enabled, setEnabled] = useNoAnimationPreference();
  return <div className="pi-settings-row is-static">
    <span className="pi-settings-icon" aria-hidden="true"><IconPlayerPause size={16} stroke={1.7} /></span>
    <label className="pi-settings-title" htmlFor="setting-no-animation">无动画模式</label>
    <PrkSwitch id="setting-no-animation" checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} />
  </div>;
}

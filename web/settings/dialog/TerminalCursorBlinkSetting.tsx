import { IconCursorText } from "@tabler/icons-react";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import { useTerminalCursorBlink } from "../../workspace/terminal/use-terminal-cursor-blink.ts";

export function TerminalCursorBlinkSetting() {
  const [enabled, setEnabled] = useTerminalCursorBlink();
  return <div className="pi-settings-row is-static">
    <span className="pi-settings-icon" aria-hidden="true"><IconCursorText size={16} stroke={1.7} /></span>
    <label className="pi-settings-title" htmlFor="setting-terminal-cursor-blink">终端光标闪烁</label>
    <PrkSwitch id="setting-terminal-cursor-blink" checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} />
  </div>;
}

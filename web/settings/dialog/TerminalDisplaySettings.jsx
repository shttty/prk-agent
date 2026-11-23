import { NumberInput, Switch } from "@mantine/core";
import { IconCursorText, IconTerminal2 } from "@tabler/icons-react";
import { useTerminalCursorBlink } from "../../workspace/terminal/use-terminal-cursor-blink.js";
import { useTerminalFontSize } from "../../workspace/terminal/font-size/use-terminal-font-size.js";
import { TERMINAL_FONT_SIZE } from "../../workspace/terminal/terminal-constants.js";

const label = "终端字号";

export function TerminalDisplaySettings() {
  const [size, setSize] = useTerminalFontSize();
  const [cursorBlink, setCursorBlink] = useTerminalCursorBlink();
  return <section className="settings-section" data-section="terminal-display">
    <h3 className="pi-settings-heading">终端</h3>
    <div className="pi-settings-group">
      <div className="pi-settings-row is-static">
        <span className="pi-settings-icon" aria-hidden="true"><IconTerminal2 size={16} stroke={1.7} /></span>
        <span className="pi-settings-title">{label}</span>
        <NumberInput id="setting-terminal-font-size" aria-label={label} size="xs" w={84} value={size} min={TERMINAL_FONT_SIZE.min} max={TERMINAL_FONT_SIZE.max}
          allowDecimal={false} clampBehavior="strict" suffix=" px" onChange={(value) => { if (Number.isInteger(value)) setSize(value); }} />
      </div>
      <div className="pi-settings-row is-static">
        <span className="pi-settings-icon" aria-hidden="true"><IconCursorText size={16} stroke={1.7} /></span>
        <label className="pi-settings-title" htmlFor="setting-terminal-cursor-blink">终端光标闪烁</label>
        <Switch id="setting-terminal-cursor-blink" size="xs" checked={cursorBlink} onChange={(event) => setCursorBlink(event.currentTarget.checked)} />
      </div>
    </div>
  </section>;
}

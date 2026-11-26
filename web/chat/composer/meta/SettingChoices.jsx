import { Menu } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useComposerSettings } from "./use-composer-settings.js";
export const TOOL_MODES = ["code", "direct"];
const check = (on) => <span className="pi-setting-check">{on ? <IconCheck size={14} stroke={2} /> : null}</span>;
/** Thinking-level or tool-mode values as menu items (raw SDK values, current one checked), for the model menu. */
export function SettingChoices({ kind, actions }) {
  const { thinkingLevel, thinkingLevels, thinkingDisabled, thinkingPlaceholder, toolMode, toolModeDisabled } = useComposerSettings();
  if (kind === "thinking") {
    const choose = (level) => { if (level !== thinkingLevel) void actions.executeNativeAction("thinking", { level }, { transcript: false }); };
    return (
      <div id="chat-thinking-menu" className="pi-setting-choices" data-setting-value={thinkingLevel || ""}>
        {thinkingLevels.length ? thinkingLevels.map((level) => (
          <Menu.Item key={level} role="menuitemradio" aria-checked={level === thinkingLevel} data-thinking-option={level} disabled={thinkingDisabled} leftSection={check(level === thinkingLevel)} onClick={() => choose(level)}>{level}</Menu.Item>
        )) : <Menu.Item disabled>{thinkingPlaceholder}</Menu.Item>}
      </div>
    );
  }
  const choose = (mode) => { if (mode !== toolMode) void actions.executeNativeAction("tool-mode", { mode }, { transcript: false }); };
  return (
    <div id="chat-tool-mode-menu" className="pi-setting-choices" data-setting-value={toolMode || ""}>
      {TOOL_MODES.map((mode) => (
        <Menu.Item key={mode} role="menuitemradio" aria-checked={mode === toolMode} data-tool-mode={mode} disabled={toolModeDisabled} leftSection={check(mode === toolMode)} onClick={() => choose(mode)}>{mode}</Menu.Item>
      ))}
    </div>
  );
}

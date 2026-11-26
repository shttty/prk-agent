import { Menu } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { memo } from "react";
import { THINKING_LABELS } from "./thinking-labels.js";
import { useComposerSettings } from "./use-composer-settings.js";
const check = (on) => on ? <IconCheck size={14} stroke={2} /> : null;
/** Thinking and tool-mode choices in the "+" menu, for a composer row too narrow to hold their selects. */
export const SettingsMenuItems = memo(function SettingsMenuItems({ actions }) {
  const { thinkingLevel, thinkingLevels, thinkingDisabled, thinkingPlaceholder, toolMode, toolModeDisabled } = useComposerSettings();
  const setThinking = (level) => { if (level !== thinkingLevel) void actions.executeNativeAction("thinking", { level }, { transcript: false }); };
  const setToolMode = (mode) => { if (mode !== toolMode) void actions.executeNativeAction("tool-mode", { mode }, { transcript: false }); };
  return (
    <>
      <Menu.Divider />
      <Menu.Label>思考程度</Menu.Label>
      <div id="chat-thinking-menu" className="pi-setting-menu-group" data-setting-value={thinkingLevel || ""}>
        {thinkingLevels.length ? thinkingLevels.map((level) => (
          <Menu.Item key={level} role="menuitemradio" aria-checked={level === thinkingLevel} data-thinking-option={level} disabled={thinkingDisabled} rightSection={check(level === thinkingLevel)} onClick={() => setThinking(level)}>{THINKING_LABELS[level] || level}</Menu.Item>
        )) : <Menu.Item disabled>{thinkingPlaceholder}</Menu.Item>}
      </div>
      <Menu.Label>工具模式</Menu.Label>
      <div id="chat-tool-mode-menu" className="pi-setting-menu-group" data-setting-value={toolMode || ""}>
        {["code", "direct"].map((mode) => (
          <Menu.Item key={mode} role="menuitemradio" aria-checked={mode === toolMode} data-tool-mode={mode} disabled={toolModeDisabled} rightSection={check(mode === toolMode)} onClick={() => setToolMode(mode)}>{mode}</Menu.Item>
        ))}
      </div>
    </>
  );
});

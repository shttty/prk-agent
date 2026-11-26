import { Menu } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import type { ChatActions } from "../../thread/chat-actions-types.ts";
import { useComposerSettings } from "./use-composer-settings.ts";
export const TOOL_MODES = ["code", "direct"];
export type SettingKind = "thinking" | "toolMode";
const check = (on: boolean) => <span className="pi-setting-check">{on ? <IconCheck size={14} stroke={2} /> : null}</span>;
/** Thinking-level or tool-mode values as menu items (raw SDK values, current one checked), for the model menu. */
export function SettingChoices({ kind, actions }: { kind: SettingKind; actions: ChatActions }) {
  const { thinkingLevel, thinkingLevels, thinkingDisabled, thinkingPlaceholder, toolMode, toolModeDisabled } = useComposerSettings();
  if (kind === "thinking") {
    const choose = (level: string) => { if (level !== thinkingLevel) void actions.executeNativeAction("thinking", { level }, { transcript: false }); };
    return (
      <div id="chat-thinking-menu" data-setting-value={thinkingLevel || ""}>
        {thinkingLevels.length ? thinkingLevels.map((level) => (
          <Menu.Item key={level} role="menuitemradio" aria-checked={level === thinkingLevel} data-thinking-option={level} disabled={thinkingDisabled} leftSection={check(level === thinkingLevel)} onClick={() => choose(level)}>{level}</Menu.Item>
        )) : <Menu.Item disabled>{thinkingPlaceholder}</Menu.Item>}
      </div>
    );
  }
  const choose = (mode: string) => { if (mode !== toolMode) void actions.executeNativeAction("tool-mode", { mode }, { transcript: false }); };
  return (
    <div id="chat-tool-mode-menu" data-setting-value={toolMode || ""}>
      {TOOL_MODES.map((mode) => (
        <Menu.Item key={mode} role="menuitemradio" aria-checked={mode === toolMode} data-tool-mode={mode} disabled={toolModeDisabled} leftSection={check(mode === toolMode)} onClick={() => choose(mode)}>{mode}</Menu.Item>
      ))}
    </div>
  );
}

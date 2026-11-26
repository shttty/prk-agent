import "./meta.css";
import { Select } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { memo } from "react";
import type { SettingKind } from "./SettingChoices.tsx";
import { ContextUsage } from "./ContextUsage.tsx";
import { ModelMenu } from "./ModelMenu.tsx";
import { TOOL_MODES } from "./SettingChoices.tsx";
import { useComposerSettings } from "./use-composer-settings.ts";
import type { ChatActions } from "../../thread/chat-actions-types.ts";
import type { ComposerTier } from "./composer-tier.ts";
import type { KeyboardEvent } from "react";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.ts";
const chevron = <IconChevronDown size={12} stroke={1.8} />;
// Which settings leave the row for the model menu, per tier.
const FOLDED: Partial<Record<ComposerTier, SettingKind[]>> = { phone: ["thinking", "toolMode"], folded: ["toolMode"] };
/**
 * Model menu, thinking / tool-mode selects and the context ring inside the composer's bottom row, between "+" and
 * send. `tier` follows the row, each step giving up a little more: "full" shows everything; "short" drops the word
 * from the context label; "tight" also shows the tool-mode pill as its bare value; "folded" moves tool mode into the
 * model menu, shows thinking as its bare value and the context ring without a number. "phone" keeps only the model
 * pill, whose menu then also holds thinking and tool mode.
 */
export const ComposerSettings = memo(function ComposerSettings({ actions, tier }: { actions: ChatActions; tier: ComposerTier }) {
  const settings = useComposerSettings();
  const { thinkingLevel, thinkingLevels, toolMode } = settings;
  const contextUsage = useWorkbench((state) => state.session.snapshot?.contextUsage);
  const sessionKey = useWorkbench((state) => `${state.selectedSessionId}:${state.session.streamId || ""}:${state.session.snapshot?.sessionId || ""}`);
  const folded = FOLDED[tier] || [];
  // The selects sit inside the composer form: Enter on a closed select must not submit the draft.
  const keepDraft = (event: KeyboardEvent) => { if (event.key === "Enter") event.preventDefault(); };
  return (
    <>
      <div className="pi-composer-settings" id="composer-settings" data-tier={tier} role="group" aria-label="会话模型与发送设置">
        <ModelMenu actions={actions} tier={tier} folded={folded} />
        {folded.includes("thinking") ? null : <Select
          id="chat-thinking-select"
          data-setting-value={thinkingLevel || ""}
          className="pi-setting-select"
          size="xs"
          variant="unstyled"
          aria-label="思考等级"
          placeholder={settings.thinkingPlaceholder}
          data={thinkingLevels.map((level) => ({ value: level, label: tier === "folded" ? level : `思考 ${level}` }))}
          renderOption={({ option }) => <span data-thinking-option={option.value}>{option.value}</span>}
          value={thinkingLevel && thinkingLevels.includes(thinkingLevel) ? thinkingLevel : null}
          onChange={(value) => { if (value && value !== thinkingLevel) void actions.executeNativeAction("thinking", { level: value }, { transcript: false }); }}
          onKeyDown={keepDraft}
          disabled={settings.thinkingDisabled}
          allowDeselect={false}
          rightSection={chevron}
          comboboxProps={{ position: "top-start", withinPortal: true, width: 140 }}
        />}
        {folded.includes("toolMode") ? null : <Select
          id="chat-tool-mode"
          data-setting-value={toolMode || ""}
          className="pi-setting-select"
          size="xs"
          variant="unstyled"
          aria-label="工具模式"
          placeholder="工具模式未知"
          data={TOOL_MODES.map((mode) => ({ value: mode, label: tier === "tight" ? mode : `工具 ${mode}` }))}
          renderOption={({ option }) => <span data-tool-mode={option.value}>{option.value}</span>}
          value={toolMode || null}
          onChange={(value) => { if (value && value !== toolMode) void actions.executeNativeAction("tool-mode", { mode: value }, { transcript: false }); }}
          onKeyDown={keepDraft}
          disabled={settings.toolModeDisabled}
          allowDeselect={false}
          rightSection={chevron}
          comboboxProps={{ position: "top-start", withinPortal: true, width: 140 }}
        />}
      </div>
      <ContextUsage usage={contextUsage} actions={actions} sessionKey={sessionKey} short={tier !== "full"} ringOnly={tier === "folded"} />
    </>
  );
});

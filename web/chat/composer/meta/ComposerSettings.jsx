import "./meta.css";
import { Select } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { memo } from "react";
import { THINKING_LABELS } from "./thinking-labels.js";
import { ContextUsage } from "./ContextUsage.jsx";
import { useComposerSettings } from "./use-composer-settings.js";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
const chevron = <IconChevronDown size={12} stroke={1.8} />;
/**
 * Model / thinking / tool-mode selects and the context ring inside the composer's bottom row, between "+" and send.
 * `tier` follows the row width: "full" names the model with its provider, "short" by name only, and "compact" also
 * leaves thinking and tool mode to the "+" menu.
 */
export const ComposerSettings = memo(function ComposerSettings({ actions, tier }) {
  const settings = useComposerSettings();
  const { modelCatalog, models, modelValue, selectedModel, thinkingLevel, thinkingLevels, toolMode } = settings;
  const contextUsage = useWorkbench((state) => state.session.snapshot?.contextUsage);
  const sessionKey = useWorkbench((state) => `${state.selectedSessionId}:${state.session.streamId || ""}:${state.session.snapshot?.sessionId || ""}`);
  const fullLabel = (model) => `${model.label} · ${model.provider}`;
  // The selects sit inside the composer form: Enter on a closed select must not submit the draft.
  const keepDraft = (event) => { if (event.key === "Enter") event.preventDefault(); };
  return (
    <>
      <div className="pi-composer-settings" id="composer-settings" data-tier={tier} role="group" aria-label="会话模型与发送设置">
        <Select
          id="chat-model-select"
          data-setting-value={modelValue}
          className="pi-setting-select pi-model-select"
          size="xs"
          variant="unstyled"
          aria-label="当前模型"
          title={modelValue || "当前模型未知"}
          placeholder={modelValue || (modelCatalog.error ? "模型目录不可用" : modelCatalog.value ? "无可用模型" : "正在读取模型…")}
          searchable
          nothingFoundMessage="没有匹配的可用模型"
          data={models.map((model) => ({ value: model.value, label: tier === "full" ? fullLabel(model) : model.label }))}
          renderOption={({ option }) => { const entry = models.find((model) => model.value === option.value); return <span data-model-option={option.value}>{entry ? fullLabel(entry) : option.label}</span>; }}
          value={selectedModel?.value || null}
          onChange={(value) => { if (value && value !== modelValue) void actions.executeNativeAction("model", { model: value }, { transcript: false }); }}
          onKeyDown={keepDraft}
          disabled={settings.modelDisabled}
          allowDeselect={false}
          rightSection={chevron}
          comboboxProps={{ position: "top-start", withinPortal: true, width: 320 }}
        />
        {tier === "compact" ? null : <>
          <Select
            id="chat-thinking-select"
            data-setting-value={thinkingLevel || ""}
            className="pi-setting-select pi-thinking-select"
            size="xs"
            variant="unstyled"
            aria-label="思考程度"
            placeholder={settings.thinkingPlaceholder}
            data={thinkingLevels.map((level) => ({ value: level, label: `思考：${THINKING_LABELS[level] || level}` }))}
            renderOption={({ option }) => <span data-thinking-option={option.value}>{option.label}</span>}
            value={thinkingLevels.includes(thinkingLevel) ? thinkingLevel : null}
            onChange={(value) => { if (value && value !== thinkingLevel) void actions.executeNativeAction("thinking", { level: value }, { transcript: false }); }}
            onKeyDown={keepDraft}
            disabled={settings.thinkingDisabled}
            allowDeselect={false}
            rightSection={chevron}
            comboboxProps={{ position: "top-start", withinPortal: true, width: 160 }}
          />
          <Select
            id="chat-tool-mode"
            data-setting-value={toolMode || ""}
            className="pi-setting-select"
            size="xs"
            variant="unstyled"
            aria-label="工具模式"
            placeholder="工具模式未知"
            data={[{ value: "code", label: "工具 code" }, { value: "direct", label: "工具 direct" }]}
            renderOption={({ option }) => <span data-tool-mode={option.value}>{option.label}</span>}
            value={toolMode || null}
            onChange={(value) => { if (value && value !== toolMode) void actions.executeNativeAction("tool-mode", { mode: value }, { transcript: false }); }}
            onKeyDown={keepDraft}
            disabled={settings.toolModeDisabled}
            allowDeselect={false}
            rightSection={chevron}
            comboboxProps={{ position: "top-start", withinPortal: true, width: 160 }}
          />
        </>}
      </div>
      <ContextUsage usage={contextUsage} actions={actions} sessionKey={sessionKey} />
    </>
  );
});

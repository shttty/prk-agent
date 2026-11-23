import "./meta/meta.css";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { Select } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { THINKING_LABELS } from "./meta/ComposerMeta.jsx";
import { ContextUsage } from "./meta/ContextUsage.jsx";
import { markMoreBeyond } from "./meta/mark-more-beyond.js";
import { useMediaQuery } from "@mantine/hooks";
import { memo } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
/** Model / thinking / tool-mode selects and the context ring under the composer; subscribes to its own fields. */
export const ComposerMeta = memo(function ComposerMeta({ actions }) {
  const selectedSessionId = useWorkbench((state) => state.selectedSessionId);
  const sleeping = useWorkbench((state) => (state.session.snapshot?.state || state.sessions.get(state.selectedSessionId)?.state) === "sleeping");
  const submitting = useWorkbench((state) => state.session.pending.has("sending"));
  const nativePending = useWorkbench((state) => state.session.pending.has("nativeActionPending"));
  const connected = useWorkbench((state) => state.session.connection === "connected");
  const modelCatalog = useWorkbench((state) => state.modelCatalog);
  const snapshotModel = useWorkbench((state) => state.session.snapshot?.model);
  const thinkingLevel = useWorkbench((state) => state.session.snapshot?.thinkingLevel);
  const toolMode = useWorkbench((state) => state.session.snapshot?.toolMode);
  const catalog = useWorkbench((state) => state.session.nativeCatalog?.value);
  const contextUsage = useWorkbench((state) => state.session.snapshot?.contextUsage);
  const sessionKey = useWorkbench((state) => `${state.selectedSessionId}:${state.session.streamId || ""}:${state.session.snapshot?.sessionId || ""}`);
  const listedModels = modelCatalog?.value?.models || [];
  const modelCandidates = catalog?.commands?.find((command) => command.name === "model")?.arguments?.find((argument) => argument.name === "model")?.candidates || [];
  const models = sleeping ? modelCandidates.filter((candidate) => candidate.available !== false).map((candidate) => listedModels.find((model) => model.value === candidate.value) || {
    value: candidate.value, label: candidate.value.slice(candidate.value.indexOf("/") + 1), provider: candidate.value.split("/")[0],
  }) : listedModels;
  const modelValue = typeof snapshotModel === "string" ? snapshotModel : "";
  const selectedModel = models.find((model) => model.value === modelValue);
  const thinkingCandidates = catalog?.commands?.find((command) => command.name === "thinking")?.arguments?.find((argument) => argument.name === "level")?.candidates || [];
  const thinkingLevels = selectedModel?.thinkingLevels || (sleeping ? thinkingCandidates.filter((candidate) => candidate.available !== false).map((candidate) => candidate.value) : []);
  // Phone: the chosen model reads by its name only (the list still names the provider), so the row fits one line.
  const compact = useMediaQuery("(max-width: 700px)", false, { getInitialValueInEffect: false });
  const fullLabel = (model) => `${model.label} · ${model.provider}`;
  const settingsDisabled = submitting || !selectedSessionId || !connected || nativePending;
  const modelAction = catalog?.actions?.find((action) => action.name === "model");
  const thinkingAction = catalog?.actions?.find((action) => action.name === "thinking");
  const toolModeAction = catalog?.actions?.find((action) => action.name === "tool-mode");
  const toolModeDisabled = !selectedSessionId || !connected || nativePending || !toolModeAction || toolModeAction.enabled === false;
  return (
    <>
    <div className="pi-composer-meta" id="composer-meta" ref={markMoreBeyond} aria-label="会话模型与发送设置">
              <Select
                id="chat-model-select"
                data-setting-value={modelValue}
                className="pi-meta-select pi-model-select"
                size="xs"
                variant="unstyled"
                aria-label="当前模型"
                title={modelValue || "当前模型未知"}
                placeholder={modelValue || (modelCatalog.error ? "模型目录不可用" : modelCatalog.value ? "无可用模型" : "正在读取模型…")}
                searchable
                nothingFoundMessage="没有匹配的可用模型"
                data={models.map((model) => ({ value: model.value, label: compact ? model.label : fullLabel(model) }))}
                renderOption={({ option }) => { const entry = models.find((model) => model.value === option.value); return <span data-model-option={option.value}>{entry ? fullLabel(entry) : option.label}</span>; }}
                value={selectedModel?.value || null}
                onChange={(value) => { if (value && value !== modelValue) void actions.executeNativeAction("model", { model: value }, { transcript: false }); }}
                disabled={settingsDisabled || modelAction?.enabled === false || !models.length}
                allowDeselect={false}
                rightSection={<IconChevronDown size={12} stroke={1.8} />}
                comboboxProps={{ position: "top-start", withinPortal: true, width: 320 }}
              />
              <Select
                id="chat-thinking-select"
                data-setting-value={thinkingLevel || ""}
                className="pi-meta-select pi-thinking-select"
                size="xs"
                variant="unstyled"
                aria-label="思考程度"
                placeholder={selectedModel && !thinkingLevels.length ? "不支持思考" : "思考程度未知"}
                data={thinkingLevels.map((level) => ({ value: level, label: `思考：${THINKING_LABELS[level] || level}` }))}
                renderOption={({ option }) => <span data-thinking-option={option.value}>{option.label}</span>}
                value={thinkingLevels.includes(thinkingLevel) ? thinkingLevel : null}
                onChange={(value) => { if (value && value !== thinkingLevel) void actions.executeNativeAction("thinking", { level: value }, { transcript: false }); }}
                disabled={settingsDisabled || thinkingAction?.enabled === false || !thinkingLevels.length}
                allowDeselect={false}
                rightSection={<IconChevronDown size={12} stroke={1.8} />}
                comboboxProps={{ position: "top-start", withinPortal: true, width: 160 }}
              />
              <Select
                id="chat-tool-mode"
                data-setting-value={toolMode || ""}
                className="pi-meta-select"
                size="xs"
                variant="unstyled"
                aria-label="工具模式"
                placeholder="工具模式未知"
                data={[
                  { value: "code", label: "工具 code" },
                  { value: "direct", label: "工具 direct" },
                ]}
                renderOption={({ option }) => <span data-tool-mode={option.value}>{option.label}</span>}
                value={toolMode || null}
                onChange={(value) => { if (value && value !== toolMode) void actions.executeNativeAction("tool-mode", { mode: value }, { transcript: false }); }}
                disabled={toolModeDisabled}
                allowDeselect={false}
                rightSection={<IconChevronDown size={12} stroke={1.8} />}
                comboboxProps={{ position: "top-start", withinPortal: true, width: 160 }}
              />
              <span className="pi-meta-spacer" />
              <div className="pi-meta-local-controls">
                <ContextUsage usage={contextUsage} actions={actions} sessionKey={sessionKey} />
              </div>
            </div>
            {modelCatalog.error ? <InlineAlert color="yellow" role="status" className="pi-model-error">模型目录不可用：{modelCatalog.error}</InlineAlert> : null}
    </>
  );
});

import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
/** Model, thinking and tool-mode choices for the selected session, shared by the inline selects and the "+" menu. */
export function useComposerSettings() {
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
  const listedModels = modelCatalog?.value?.models || [];
  const modelCandidates = catalog?.commands?.find((command) => command.name === "model")?.arguments?.find((argument) => argument.name === "model")?.candidates || [];
  // Asleep, the catalog's model command still lists what the session can switch to; the live model list needs a kernel.
  const models = sleeping ? modelCandidates.filter((candidate) => candidate.available !== false).map((candidate) => listedModels.find((model) => model.value === candidate.value) || {
    value: candidate.value, label: candidate.value.slice(candidate.value.indexOf("/") + 1), provider: candidate.value.split("/")[0],
  }) : listedModels;
  const modelValue = typeof snapshotModel === "string" ? snapshotModel : "";
  const selectedModel = models.find((model) => model.value === modelValue);
  const thinkingCandidates = catalog?.commands?.find((command) => command.name === "thinking")?.arguments?.find((argument) => argument.name === "level")?.candidates || [];
  const thinkingLevels = selectedModel?.thinkingLevels || (sleeping ? thinkingCandidates.filter((candidate) => candidate.available !== false).map((candidate) => candidate.value) : []);
  const settingsDisabled = submitting || !selectedSessionId || !connected || nativePending;
  const enabled = (name) => catalog?.actions?.find((action) => action.name === name)?.enabled !== false;
  const toolModeAction = catalog?.actions?.find((action) => action.name === "tool-mode");
  return {
    modelCatalog, models, modelValue, selectedModel, thinkingLevel, thinkingLevels, toolMode,
    modelDisabled: settingsDisabled || !enabled("model") || !models.length,
    thinkingDisabled: settingsDisabled || !enabled("thinking") || !thinkingLevels.length,
    toolModeDisabled: !selectedSessionId || !connected || nativePending || !toolModeAction || toolModeAction.enabled === false,
    thinkingPlaceholder: selectedModel && !thinkingLevels.length ? "不支持思考" : "思考程度未知",
  };
}

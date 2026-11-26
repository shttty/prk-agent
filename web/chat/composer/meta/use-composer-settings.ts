import { useChatState } from "../../thread/use-chat-state.ts";
import type { CatalogModel } from "../composer-types.ts";
/** Model, thinking and tool-mode choices for the selected session, shared by the inline selects and the "+" menu. */
export function useComposerSettings() {
  const selectedSessionId = useChatState((state) => state.selectedSessionId);
  const sleeping = useChatState((state) => (state.session.snapshot?.state || (state.selectedSessionId ? state.sessions.get(state.selectedSessionId)?.state : undefined)) === "sleeping");
  const submitting = useChatState((state) => state.session.pending.has("sending"));
  const nativePending = useChatState((state) => state.session.pending.has("nativeActionPending"));
  const connected = useChatState((state) => state.session.connection === "connected");
  const modelCatalog = useChatState((state) => state.modelCatalog);
  const snapshotModel = useChatState((state) => state.session.snapshot?.model);
  const thinkingLevel = useChatState((state) => state.session.snapshot?.thinkingLevel);
  const toolMode = useChatState((state) => state.session.snapshot?.toolMode);
  const catalog = useChatState((state) => state.session.nativeCatalog?.value);
  const listedModels: CatalogModel[] = modelCatalog.value?.models || [];
  const modelCandidates = catalog?.commands?.find((command) => command.name === "model")?.arguments?.find((argument) => argument.name === "model")?.candidates || [];
  // Asleep, the catalog's model command still lists what the session can switch to; the live model list needs a kernel.
  const models: CatalogModel[] = sleeping ? modelCandidates.filter((candidate) => candidate.available !== false).map((candidate) => listedModels.find((model) => model.value === candidate.value) || {
    value: candidate.value, label: candidate.value.slice(candidate.value.indexOf("/") + 1), provider: candidate.value.split("/")[0] ?? "",
  }) : listedModels;
  const modelValue = typeof snapshotModel === "string" ? snapshotModel : "";
  const selectedModel = models.find((model) => model.value === modelValue);
  const thinkingCandidates = catalog?.commands?.find((command) => command.name === "thinking")?.arguments?.find((argument) => argument.name === "level")?.candidates || [];
  const thinkingLevels: string[] = selectedModel?.thinkingLevels || (sleeping ? thinkingCandidates.filter((candidate) => candidate.available !== false).map((candidate) => candidate.value) : []);
  const settingsDisabled = submitting || !selectedSessionId || !connected || nativePending;
  const enabled = (name: string) => catalog?.actions?.find((action) => action.name === name)?.enabled !== false;
  const toolModeAction = catalog?.actions?.find((action) => action.name === "tool-mode");
  return {
    modelCatalog, models, modelValue, selectedModel, thinkingLevel, thinkingLevels, toolMode,
    modelDisabled: settingsDisabled || !enabled("model") || !models.length,
    thinkingDisabled: settingsDisabled || !enabled("thinking") || !thinkingLevels.length,
    toolModeDisabled: !selectedSessionId || !connected || nativePending || !toolModeAction || toolModeAction.enabled === false,
    thinkingPlaceholder: selectedModel && !thinkingLevels.length ? "不支持思考" : "思考程度未知",
  };
}

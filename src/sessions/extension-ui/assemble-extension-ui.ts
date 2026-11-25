import { createUiState } from "./ui-state.ts";
import type { HostedExtensionUI, HostedCustomFactory, HostedCustomOptions } from "./ui-types.ts";
import type { AgentSession, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { requireTheme } from "./theme/require-theme.ts";
import { notify } from "./notifications/notify.ts";
import { snapshot } from "./publication/get-snapshot.ts";
import { render } from "./messages/build-client-view.ts";
import { cancel } from "./lifecycle/cancel.ts";
import { reset } from "./lifecycle/reset.ts";
import { action } from "./act-ui.ts";
import { dispose } from "./lifecycle/dispose.ts";
import { ask } from "./dialogs/ask.ts";
import { readUserWait } from "./dialogs/read-user-wait.ts";
import { select } from "./dialogs/select.ts";
import { confirm } from "./dialogs/confirm.ts";
import { input } from "./dialogs/input.ts";
import { editor } from "./dialogs/editor.ts";
import { onTerminalInput } from "./tui/input/subscribe-terminal-input.ts";
import { setStatus } from "./presentation/set-status.ts";
import { setWorkingMessage } from "./presentation/set-working-message.ts";
import { setWorkingVisible } from "./presentation/set-working-visible.ts";
import { setWorkingIndicator } from "./presentation/set-working-indicator.ts";
import { setHiddenThinkingLabel } from "./presentation/set-hidden-thinking-label.ts";
import { setWidget } from "./presentation/set-widget.ts";
import { setFooter } from "./footer/set-footer.ts";
import { setHeader } from "./presentation/set-header.ts";
import { setTitle } from "./presentation/set-title.ts";
import { custom } from "./components/open-custom.ts";
import { pasteToEditor } from "./editor/paste.ts";
import { setEditorText } from "./editor/set-text.ts";
import { getEditorText } from "./editor/get-text.ts";
import { addAutocompleteProvider } from "./autocomplete/add-provider.ts";
import { setEditorComponent } from "./editor/ignore-component-replacement.ts";
import { getEditorComponent } from "./editor/get-component.ts";
import { getAllThemes } from "./theme/list.ts";
import { getTheme } from "./theme/get.ts";
import { setTheme } from "./theme/reject-switch.ts";
import { getToolsExpanded } from "./tools/get-tools-expanded.ts";
import { setToolsExpanded } from "./tools/set-tools-expanded.ts";
import { getGitBranch } from "./footer/get-git-branch.ts";
import { getExtensionStatuses } from "./footer/get-extension-statuses.ts";
import { getAvailableProviderCount } from "./footer/get-provider-count.ts";
import { onBranchChange } from "./footer/subscribe-branch.ts";
import { loadKeybindings } from "./tui/input/load-keybindings.ts";
import { observeToolExecution } from "./tools/observe-tool-execution.ts";
import { subscribe } from "./publication/subscribe.ts";
import { getToolExecution } from "./tools/get-tool-execution.ts";

export async function createHostedExtensionUI(session: AgentSession, agentDir: string): Promise<HostedExtensionUI> {
  const keybindings = await loadKeybindings(agentDir);
  const ctx = createUiState(session, agentDir, keybindings);
  ctx.footerData = {
    getGitBranch: () => getGitBranch(ctx),
    getExtensionStatuses: () => getExtensionStatuses(ctx),
    getAvailableProviderCount: () => getAvailableProviderCount(ctx),
    onBranchChange: (listener) => onBranchChange(ctx, listener),
  };
  const context: ExtensionUIContext = {
    select: (title, options, opts) => select(ctx, title, options, opts),
    confirm: (title, message, opts) => confirm(ctx, title, message, opts),
    input: (title, placeholder, opts) => input(ctx, title, placeholder, opts),
    editor: (title, prefill) => editor(ctx, title, prefill),
    notify: (message, type) => notify(ctx, message, type),
    onTerminalInput: (handler) => onTerminalInput(ctx, handler),
    setStatus: (key, text) => setStatus(ctx, key, text),
    setWorkingMessage: (message) => setWorkingMessage(ctx, message),
    setWorkingVisible: (visible) => setWorkingVisible(ctx, visible),
    setWorkingIndicator: (indicator) => setWorkingIndicator(ctx, indicator),
    setHiddenThinkingLabel: (label) => setHiddenThinkingLabel(ctx, label),
    setWidget: (key, content, options) => setWidget(ctx, key, content, options),
    setFooter: (factory) => setFooter(ctx, factory),
    setHeader: (factory) => setHeader(ctx, factory),
    setTitle: (title) => setTitle(ctx, title),
    custom: <T>(factory: HostedCustomFactory<T>, options?: HostedCustomOptions) => custom(ctx, factory, options),
    pasteToEditor: (text) => pasteToEditor(ctx, text),
    setEditorText: (text) => setEditorText(ctx, text),
    getEditorText: () => getEditorText(ctx),
    addAutocompleteProvider: (factory) => addAutocompleteProvider(ctx, factory),
    setEditorComponent: () => setEditorComponent(ctx),
    getEditorComponent: () => getEditorComponent(ctx),
    get theme() { return requireTheme(ctx); },
    getAllThemes: () => getAllThemes(ctx),
    getTheme: (name) => getTheme(ctx, name),
    setTheme: () => setTheme(ctx),
    getToolsExpanded: () => getToolsExpanded(ctx),
    setToolsExpanded: (expanded) => setToolsExpanded(ctx, expanded),
  };
  ctx.unsubscribe = observeToolExecution(ctx);
  return {
    context, snapshot: () => snapshot(ctx), subscribe: (listener) => subscribe(ctx, listener),
    render: (width, height, clientId, expandedToolCallIds: readonly string[] = [], operationId?: string) => render(ctx, width, height, clientId, expandedToolCallIds, operationId),
    action: (args) => action(ctx, args), cancel: (scope) => cancel(ctx, scope), reset: () => reset(ctx), dispose: () => dispose(ctx),
    ask: (questions, options) => ask(ctx, questions, options), userWait: () => readUserWait(ctx),
    toolExecution: (id) => getToolExecution(ctx, id),
  };
}

import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { UiContext, HostedKeybindingsManager } from "./ui-types.ts";

export function createUiState(session: AgentSession, agentDir: string, keybindings: HostedKeybindingsManager): UiContext {
  return {
    session, agentDir, keybindings, listeners: new Set(), dialogs: new Map(), clients: new Map(), tools: new Map(), executions: new Map(),
    disposedComponents: new WeakSet(), componentIds: new WeakMap(), settingsSubmenus: new Map(), terminalInputHandlers: new Set(),
    autocompleteProviders: [], rendering: false, completions: new Map(), disposed: false, sequence: 0, revision: 0, toolErrors: {},
    state: { status: new Map(), notifications: [], working: { visible: true }, widgets: new Map(), editorText: "", editorRevision: 0, toolsExpanded: false },
    branchListeners: new Set(), branch: null, branchRefreshing: false,
  };
}

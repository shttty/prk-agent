import type { AgentSession, AutocompleteProviderFactory, ExtensionUIContext, ReadonlyFooterDataProvider, WorkingIndicatorOptions, ToolRenderers, Theme } from "@earendil-works/pi-coding-agent";
import type { AutocompleteProvider, Component, SelectItem, SettingItem, OverlayOptions, TUI } from "@earendil-works/pi-tui";
import type { AskOutcome, AskQuestion } from "../../plugins/ask/tools/ask-types.ts";

export type UiState = {
  readonly status: Map<string, string>;
  notifications: readonly (HostedExtensionUiSnapshot["notifications"][number] & { readonly messageOffset: number })[];
  working: HostedExtensionUiSnapshot["working"];
  hiddenThinkingLabel?: string;
  title?: string;
  readonly widgets: Map<string, Widget>;
  header?: Component;
  footer?: Component;
  editorText: string;
  editorRevision: number;
  editorClientId?: string;
  toolsExpanded: boolean;
};

export interface UiContext {
  readonly session: AgentSession;
  readonly agentDir: string;
  readonly keybindings: HostedKeybindingsManager;
  readonly listeners: Set<() => void>;
  readonly dialogs: Map<string, Dialog>;
  readonly clients: Map<string, ClientState>;
  readonly tools: Map<string, ToolState>;
  readonly executions: Map<string, ToolExecution>;
  readonly disposedComponents: WeakSet<Component>;
  readonly componentIds: WeakMap<Component, number>;
  readonly settingsSubmenus: Map<RuntimeSettingsList, SettingsSubmenu>;
  readonly terminalInputHandlers: Set<(data: string) => { consume?: boolean; data?: string } | undefined>;
  readonly autocompleteProviders: AutocompleteProviderFactory[];
  rendering: boolean;
  autocompleteProvider?: AutocompleteProvider;
  readonly completions: Map<string, AbortController>;
  custom?: CustomState;
  disposed: boolean;
  sequence: number;
  revision: number;
  toolErrors: Record<string, { call?: string; result?: string }>;
  readonly state: UiState;
  readonly branchListeners: Set<() => void>;
  branchTimer?: NodeJS.Timeout;
  branchCwd?: string;
  branch: string | null;
  branchRefreshing: boolean;
  footerData?: ReadonlyFooterDataProvider;
  unsubscribe?: () => void;
}

export type ToolRenderContext = Parameters<NonNullable<ToolRenderers["renderCall"]>>[2];

export type Placement = "aboveEditor" | "belowEditor";

export type PromptKind = "select" | "confirm" | "input" | "editor" | "ask" | "custom";

export type HostedNode =
  | { readonly id: string; readonly kind: "text"; readonly lines: readonly string[]; readonly blocked?: string }
  | { readonly id: string; readonly kind: "container"; readonly direction: "row" | "column"; readonly children: readonly HostedNode[] }
  | { readonly id: string; readonly kind: "input" | "editor"; readonly value: string; readonly submit: boolean; readonly cancel: boolean }
  | { readonly id: string; readonly kind: "select"; readonly selectedIndex: number; readonly value?: string; readonly options: readonly { readonly value: string; readonly label: string; readonly description?: string }[]; readonly submit: boolean; readonly cancel: boolean }
  | { readonly id: string; readonly kind: "settings"; readonly items: readonly { readonly id: string; readonly label: string; readonly value: string; readonly options?: readonly string[]; readonly description?: string; readonly submenu?: boolean }[]; readonly submenu?: HostedNode; readonly submit: boolean; readonly cancel: boolean };

export type HostedExtensionUiSnapshot = {
  readonly revision: number;
  readonly status: readonly { readonly key: string; readonly text: string }[];
  readonly notifications: readonly { readonly id: string; readonly message: string; readonly type: "info" | "warning" | "error"; readonly sessionId: string; readonly anchorEntryId: string | null; readonly position: number; readonly afterEntryId?: string | null; readonly afterLive?: boolean; readonly createdAt: number }[];
  readonly working: { readonly message?: string; readonly visible: boolean; readonly indicator?: WorkingIndicatorOptions };
  readonly hiddenThinkingLabel?: string;
  readonly title?: string;
  readonly autocomplete: boolean;
  readonly editor: { readonly text: string; readonly revision: number; readonly clientId?: string };
  readonly toolsExpanded: boolean;
  readonly widgets: readonly { readonly key: string; readonly placement: Placement }[];
  readonly prompts: readonly {
    readonly id: string;
    readonly kind: PromptKind;
    readonly title?: string;
    readonly message?: string;
    readonly placeholder?: string;
    readonly prefill?: string;
    readonly options?: readonly string[];
    readonly expiresAt?: number;
    readonly overlay?: Omit<OverlayOptions, "visible">;
    readonly hidden?: boolean;
    readonly focused?: boolean;
    readonly questions?: readonly AskQuestion[];
    readonly cellId?: string;
    readonly kernelId?: string;
  }[];
};

export type UserWait = { readonly blocked?: true; readonly asking?: true };

export interface HostedExtensionUI {
  readonly context: ExtensionUIContext;
  readonly snapshot: () => HostedExtensionUiSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly render: (width: number, height: number, clientId: string) => unknown;
  readonly action: (args: Record<string, unknown>) => Promise<unknown>;
  /** Raise an `ask` card and wait; undefined = cancelled (closed, aborted or the turn stopped). A timeout answers by itself. */
  readonly ask: (questions: readonly AskQuestion[], options: { signal?: AbortSignal; timeoutMs: number }) => Promise<AskOutcome | undefined>;
  readonly userWait: () => UserWait;
  /** Latest observed tool payload until SDK agent_end; persisted messages always take precedence. */
  readonly toolExecution: (toolCallId: string) => ToolExecutionSnapshot | undefined;
  readonly cancel: (scope?: "operation") => void;
  readonly reset: () => void;
  readonly dispose: () => void;
}

export type Dialog = {
  readonly id: string;
  readonly kind: Exclude<PromptKind, "custom">;
  readonly title: string;
  readonly message?: string;
  readonly placeholder?: string;
  readonly options?: readonly string[];
  readonly prefill?: string;
  readonly expiresAt?: number;
  readonly resolve: (value: unknown) => void;
  readonly timer?: NodeJS.Timeout;
  readonly abort?: AbortSignal;
  readonly onAbort: () => void;
  readonly ask?: { readonly questions: readonly AskQuestion[]; readonly cellId?: string; readonly kernelId?: string };
};

export type Overlay = {
  readonly id: string;
  readonly component: Component;
  readonly options?: OverlayOptions;
  hidden: boolean;
  focused: boolean;
};

export type CustomState = {
  readonly id: string;
  readonly overlay: boolean;
  component?: Component;
  primary?: Overlay;
  readonly options?: HostedCustomOptions;
  readonly overlays: Map<string, Overlay>;
  readonly done: (value: unknown) => void;
};

export type Widget = { readonly placement: Placement; readonly lines?: readonly string[]; readonly component?: Component };

export type ClientState = { width: number; height: number; expandedToolCallIds: ReadonlySet<string>; nodes: Map<string, Component>; renderers: Map<string, Component> };

export type ToolState = { readonly state: Record<string, unknown>; args: unknown; callComponent?: Component; resultComponent?: Component; callLines?: readonly string[]; resultLines?: readonly string[] };

export type ToolExecution = { toolName: string; parentToolCallId?: string; args: unknown; result?: unknown; partial: boolean; started: boolean; isError: boolean; durationMs?: number };

export interface ToolExecutionSnapshot {
  readonly args: unknown;
  readonly result?: unknown;
}

export type SettingsSubmenu = { component?: Component; closed: boolean; readonly close: (selectedValue?: string, options?: { navigateTo?: string }) => void };

export type HostedEditorFactory = NonNullable<ExtensionUIContext["getEditorComponent"] extends () => infer T ? T : never>;

export type RuntimeSelectList = Component & { readonly filteredItems: readonly SelectItem[]; readonly selectedIndex: number; readonly onSelect?: (item: SelectItem) => void; readonly onCancel?: () => void; readonly onSelectionChange?: (item: SelectItem) => void; setSelectedIndex(index: number): void; getSelectedItem(): SelectItem | null };

export type RuntimeSettingsList = Component & { readonly items: readonly SettingItem[]; readonly selectedIndex: number; readonly onChange?: (id: string, value: string) => void; readonly onCancel?: () => void; updateValue(id: string, value: string): void; selectItem(id: string): void };

export type HostedKeybindingsManager = Parameters<HostedEditorFactory>[2];

export type HostedComponent = Component & { dispose?(): void };

export type HostedCustomFactory<T> = (tui: TUI, theme: Theme, keybindings: HostedKeybindingsManager, done: (result: T) => void) => HostedComponent | Promise<HostedComponent>;

export type HostedCustomOptions = Parameters<ExtensionUIContext["custom"]>[1];

export type RuntimeInput = Component & { getValue(): string; setValue(value: string): void; onSubmit?: (value: string) => void; onEscape?: () => void };

export type RuntimeEditor = Component & { getText(): string; setText(value: string): void; onSubmit?: (value: string) => void; onChange?: (value: string) => void };

export type MessageLike = { role?: string; content?: unknown; summary?: string; customType?: string; display?: boolean; toolCallId?: string; toolName?: string; details?: unknown; isError?: boolean; durationMs?: number };

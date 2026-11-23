import {
  ArminComponent,
  AssistantMessageComponent,
  BorderedLoader,
  BranchSummaryMessageComponent,
  CompactionSummaryMessageComponent,
  CustomEditor,
  CustomMessageComponent,
  DynamicBorder,
  ExtensionEditorComponent,
  ExtensionInputComponent,
  ExtensionSelectorComponent,
  LoginDialogComponent,
  OAuthSelectorComponent,
  SessionSelectorComponent,
  ShowImagesSelectorComponent,
  SkillInvocationMessageComponent,
  ThemeSelectorComponent,
  ThinkingSelectorComponent,
  TreeSelectorComponent,
  UserMessageComponent,
  UserMessageSelectorComponent,
  SessionManager,
  getAgentDir,
  getMarkdownTheme,
  getSelectListTheme,
  getSettingsListTheme,
  type KeybindingsManager,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import {
  Box,
  CancellableLoader,
  Container,
  isFocusable,
  Editor,
  HStack,
  Image,
  Input,
  Loader,
  Markdown,
  MouseRegion,
  ScrollView,
  SelectList,
  SettingsList,
  Spacer,
  Text,
  TruncatedText,
  VStack,
  type Component,
  type TUI,
} from "@earendil-works/pi-tui";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ProbeCase } from "./probe-types.ts";


type Closable = Component & { dispose?: () => void; stop?: () => void };

/** A deliberately opaque component: only render, handleInput and invalidate are needed. */
class OpaqueProbe implements Component {
  private line = "opaque component ready";
  render(_width: number): string[] {
    return [this.line, "Esc closes this component."];
  }
  handleInput(data: string): void {
    if (data === "o") this.line = "opaque component received: o";
  }
  invalidate(): void {
    // Intentionally empty: this component has no render cache.
  }
}

class ProbeFrame extends Container {
  private readonly child: Closable;
  private readonly input: Component;
  private readonly close: () => void;
  private hasFocus = false;

  constructor(label: string, child: Closable, close: () => void, input: Component) {
    super();
    this.child = child;
    this.input = input;
    this.close = close;
    this.addChild(new Text(`COMPONENT ${label}`, 0, 0));
    this.addChild(child);
    this.addChild(new Text("Esc closes; callbacks are observed, not simulated.", 0, 0));
  }

  get focused() { return this.hasFocus; }
  set focused(value: boolean) {
    this.hasFocus = value;
    if (isFocusable(this.input)) this.input.focused = value;
  }

  handleInput(data: string): void {
    this.input.handleInput?.(data);
    if (data === "\u001b" || data === "\u0003") this.close();
  }

  dispose(): void {
    this.child.stop?.();
    this.child.dispose?.();
  }
}

function open<T extends Closable>(
  ctx: ExtensionCommandContext,
  label: string,
  build: (tui: TUI, theme: Theme, keybindings: KeybindingsManager, close: () => void) => T,
  input?: (component: T) => Component,
): Promise<void> {
  return ctx.ui.custom<void>((tui, theme, keybindings, done) => {
    const close = () => done(undefined);
    const component = build(tui, theme, keybindings, close);
    return new ProbeFrame(label, component, close, input?.(component) ?? component);
  });
}

const editorTheme = (theme: Theme) => ({
  borderColor: (value: string) => theme.fg("border", value),
  selectList: getSelectListTheme(),
});

const text = (value: string) => new Text(value);

const tuiBox: ProbeCase = (ctx) => open(ctx, "Box", () => {
  const box = new Box(1, 0);
  box.addChild(text("Box child"));
  return box;
});
const tuiCancellableLoader: ProbeCase = (ctx) => open(ctx, "CancellableLoader", (tui, theme) => {
  const loader = new CancellableLoader(tui, theme.fg.bind(theme, "accent"), theme.fg.bind(theme, "muted"), "Esc aborts loader");
  loader.onAbort = () => ctx.ui.notify("CancellableLoader onAbort", "info");
  return loader;
});
const tuiEditor: ProbeCase = (ctx) => open(ctx, "Editor", (tui, _theme, _keys, close) => {
  const editor = new Editor(tui, editorTheme(_theme));
  editor.setText("Editor: type, then press Esc");
  editor.onSubmit = (value) => ctx.ui.notify(`Editor submit: ${value}`, "info");
  return editor;
});
const tuiHStack: ProbeCase = (ctx) => open(ctx, "HStack", () => new HStack([text("left"), text("right")]));
const tuiImage: ProbeCase = (ctx) => open(ctx, "Image", () => new Image(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==",
  "image/png",
  { fallbackColor: (value) => value },
  { maxWidthCells: 12, maxHeightCells: 4 },
));
const tuiInput: ProbeCase = (ctx) => open(ctx, "Input", (_tui, _theme, _keys, close) => {
  const input = new Input({ prompt: "> ", placeholder: "type and Enter" });
  input.onSubmit = (value) => { ctx.ui.notify(`Input submit: ${value}`, "info"); close(); };
  input.onEscape = close;
  input.focused = true;
  return input;
});
const tuiLoader: ProbeCase = (ctx) => open(ctx, "Loader", (tui, theme) => new Loader(
  tui, theme.fg.bind(theme, "accent"), theme.fg.bind(theme, "muted"), "animated loader", { intervalMs: 120 },
));
const tuiMarkdown: ProbeCase = (ctx) => open(ctx, "Markdown", () => new Markdown(
  "# Markdown\n\n**bold** and `code`\n\n- item",
  0, 0, getMarkdownTheme(),
));
const tuiMouseRegion: ProbeCase = (ctx) => open(ctx, "MouseRegion", () => new MouseRegion(
  text("Click this row; mouse callback notifies"),
  (event) => { ctx.ui.notify(`MouseRegion ${event.type}`, "info"); return { handled: true }; },
));
const tuiScrollView: ProbeCase = (ctx) => open(ctx, "ScrollView", () => new ScrollView(
  new VStack(Array.from({ length: 8 }, (_, i) => text(`scroll row ${i + 1}`))),
  { scrollbar: "always", follow: "none" },
));
const tuiSelectList: ProbeCase = (ctx) => open(ctx, "SelectList", (_tui, theme, _keys, close) => {
  const list = new SelectList(
    [{ value: "one", label: "One", description: "Enter selects" }, { value: "two", label: "Two" }],
    4, getSelectListTheme(),
  );
  list.onSelect = (item) => { ctx.ui.notify(`SelectList: ${item.value}`, "info"); close(); };
  list.onCancel = close;
  return list;
});
const tuiSettingsList: ProbeCase = (ctx) => open(ctx, "SettingsList", (_tui, _theme, _keys, close) => new SettingsList(
  [{ id: "mode", label: "Mode", currentValue: "probe", values: ["probe", "changed"] }],
  4, getSettingsListTheme(), (id, value) => ctx.ui.notify(`SettingsList ${id}=${value}`, "info"), close,
));
const tuiSpacer: ProbeCase = (ctx) => open(ctx, "Spacer", () => new Spacer(2));
const tuiText: ProbeCase = (ctx) => open(ctx, "Text", () => new Text("Text component"));
const tuiTruncatedText: ProbeCase = (ctx) => open(ctx, "TruncatedText", () => new TruncatedText(`TruncatedText ${"long line ".repeat(30)}`, 1));
const tuiVStack: ProbeCase = (ctx) => open(ctx, "VStack", () => new VStack([text("top"), text("bottom")]));

const piTuiCases = {
  "tui-box": tuiBox,
  "tui-cancellable-loader": tuiCancellableLoader,
  "tui-editor": tuiEditor,
  "tui-hstack": tuiHStack,
  "tui-image": tuiImage,
  "tui-input": tuiInput,
  "tui-loader": tuiLoader,
  "tui-markdown": tuiMarkdown,
  "tui-mouse-region": tuiMouseRegion,
  "tui-scroll-view": tuiScrollView,
  "tui-select-list": tuiSelectList,
  "tui-settings-list": tuiSettingsList,
  "tui-spacer": tuiSpacer,
  "tui-text": tuiText,
  "tui-truncated-text": tuiTruncatedText,
  "tui-vstack": tuiVStack,
} satisfies Record<string, ProbeCase>;

const simpleMessages = {
  "pi-assistant-message": async (ctx) => {
    const entry = ctx.sessionManager.getBranch().findLast((entry) => entry.type === "message" && entry.message.role === "assistant");
    if (!entry || entry.type !== "message" || entry.message.role !== "assistant") {
      ctx.ui.notify("Run /probe send-user-message first: this case renders the real assistant reply.", "warning");
      return;
    }
    const message = entry.message;
    await open(ctx, "AssistantMessageComponent (real session reply)", () => new AssistantMessageComponent(message));
  },
  "pi-bash-execution": (ctx) => { ctx.ui.setEditorText("!!printf 'pi-ui-probe native bash\\n'"); ctx.ui.notify("Enter runs native BashExecutionComponent, excluded from model context.", "info"); },
  "pi-branch-summary": (ctx) => open(ctx, "BranchSummaryMessageComponent", () => new BranchSummaryMessageComponent({ role: "branchSummary", summary: "probe branch summary", fromId: null, timestamp: Date.now() })),
  "pi-compaction-summary": (ctx) => open(ctx, "CompactionSummaryMessageComponent", () => new CompactionSummaryMessageComponent({ role: "compactionSummary", summary: "probe compaction summary", tokensBefore: 42, timestamp: Date.now() })),
  "pi-custom-message": (ctx) => open(ctx, "CustomMessageComponent", () => new CustomMessageComponent({ role: "custom", customType: "probe", content: "custom message", display: true, timestamp: Date.now() })),
  "pi-dynamic-border": (ctx) => open(ctx, "DynamicBorder", (tui, theme) => new DynamicBorder((value) => theme.fg("border", value))),
  "pi-skill-message": (ctx) => open(ctx, "SkillInvocationMessageComponent", () => new SkillInvocationMessageComponent({ name: "probe", location: "fixture", content: "skill body", userMessage: undefined })),
  "pi-user-message": (ctx) => open(ctx, "UserMessageComponent", () => new UserMessageComponent("User message component", getMarkdownTheme())),
} satisfies Record<string, ProbeCase>;
const interactiveCases = {
  "pi-armin": (ctx) => open(ctx, "ArminComponent", (tui) => new ArminComponent(tui)),
  "pi-bordered-loader": (ctx) => open(ctx, "BorderedLoader", (tui, theme) => {
    const loader = new BorderedLoader(tui, theme, "bordered loader", { cancellable: true });
    loader.onAbort = () => ctx.ui.notify("BorderedLoader onAbort", "info");
    return loader;
  }),
  "pi-custom-editor": (ctx) => open(ctx, "CustomEditor", (tui, theme, keybindings) => new CustomEditor(tui, editorTheme(theme), keybindings)), 
  "pi-extension-editor": (ctx) => open(ctx, "ExtensionEditorComponent", (tui, _theme, keybindings, close) => new ExtensionEditorComponent(tui, keybindings, "Extension editor", "prefilled", (value) => ctx.ui.notify(`ExtensionEditor submit: ${value}`, "info"), close)),
  "pi-extension-input": (ctx) => open(ctx, "ExtensionInputComponent", (_tui, _theme, _keys, close) => new ExtensionInputComponent("Extension input", "placeholder", (value) => { ctx.ui.notify(`ExtensionInput submit: ${value}`, "info"); close(); }, close)),
  "pi-extension-selector": (ctx) => open(ctx, "ExtensionSelectorComponent", (_tui, _theme, _keys, close) => new ExtensionSelectorComponent("Extension selector", ["alpha", "beta"], (value) => { ctx.ui.notify(`ExtensionSelector: ${value}`, "info"); close(); }, close)),
  "pi-login-dialog": (ctx) => open(ctx, "LoginDialogComponent (information only)", (tui, _theme, _keys, close) => {
    const dialog = new LoginDialogComponent(tui, ctx.model?.provider ?? "clp", (success, message) => { ctx.ui.notify(`Login callback success=${success} ${message ?? ""}`, "info"); close(); });
    dialog.showInfo("Probe information display; no authentication request is started.", [], true);
    return dialog;
  }),
  "pi-oauth-selector": (ctx) => open(ctx, "OAuthSelectorComponent", (_tui, _theme, _keys, close) => new OAuthSelectorComponent("login", [{ id: "probe", name: "Probe provider", authType: "oauth" }], (id, type) => { ctx.ui.notify(`OAuth ${id}/${type}`, "info"); close(); }, close)),
  "pi-session-selector": (ctx) => open(ctx, "SessionSelectorComponent", (tui, _theme, keybindings, close) => new SessionSelectorComponent(
    (progress, signal) => SessionManager.list(ctx.cwd, ctx.sessionManager.getSessionDir(), progress, signal),
    (progress, signal) => SessionManager.listAll(`${getAgentDir()}/sessions`, progress, signal),
    (path) => { ctx.ui.notify(`Session selected ${path} (selection callback only; no session switch)`, "info"); close(); },
    close, close, () => tui.requestRender(), { keybindings }, ctx.sessionManager.getSessionFile(),
  )),
  "pi-show-images-selector": (ctx) => open(ctx, "ShowImagesSelectorComponent", (_tui, _theme, _keys, close) => new ShowImagesSelectorComponent(false, (show) => { ctx.ui.notify(`Show images=${show}`, "info"); close(); }, close), (component) => component.getSelectList()),
  "pi-theme-selector": (ctx) => open(ctx, "ThemeSelectorComponent", (_tui, _theme, _keys, close) => new ThemeSelectorComponent(ctx.ui.theme.name ?? "system", (name) => { ctx.ui.notify(`Theme=${name}`, "info"); close(); }, close, (name) => ctx.ui.notify(`Theme preview=${name}`, "info")), (component) => component.getSelectList()),
  "pi-thinking-selector": (ctx) => open(ctx, "ThinkingSelectorComponent", (_tui, _theme, _keys, close) => new ThinkingSelectorComponent("minimal", ["minimal", "low", "medium"], (level) => { ctx.ui.notify(`Thinking=${level}`, "info"); close(); }, close)),
  "pi-tool-execution": (ctx) => { ctx.ui.notify("Native ToolExecutionComponent is exercised by the real /probe send-user-message tool round (probe_default / probe_self / probe_resolved).", "info"); },
  "pi-tree-selector": (ctx) => open(ctx, "TreeSelectorComponent", (_tui, _theme, _keys, close) => new TreeSelectorComponent(ctx.sessionManager.getTree(), ctx.sessionManager.getLeafId(), 12, (id) => { ctx.ui.notify(`Tree=${id}`, "info"); close(); }, close)), 
  "pi-user-message-selector": (ctx) => open(ctx, "UserMessageSelectorComponent", (_tui, _theme, _keys, close) => new UserMessageSelectorComponent(
    ctx.sessionManager.getBranch().flatMap((entry) => entry.type === "message" && entry.message.role === "user" ? [{ id: entry.id, text: typeof entry.message.content === "string" ? entry.message.content : entry.message.content.filter((block) => block.type === "text").map((block) => block.text).join("\n") }] : []),
    (id) => { ctx.ui.notify(`User message selected=${id} (no branch operation)`, "info"); close(); }, close,
  ), (component) => component.getMessageList()),
} satisfies Record<string, ProbeCase>;


const nativeOnlyCases = {
  "pi-footer": (ctx) => { ctx.ui.setFooter(undefined); ctx.ui.notify("Native FooterComponent restored; host owns its AgentSession.", "info"); },
  "pi-model-selector": (ctx) => { ctx.ui.setEditorText("/model"); ctx.ui.notify("Enter opens native ModelSelectorComponent; Esc closes. The host ModelRuntime is not exposed to extensions.", "info"); },
  "pi-settings-selector": (ctx) => { ctx.ui.setEditorText("/settings"); ctx.ui.notify("Enter opens native SettingsSelectorComponent; Esc closes. No shadow settings callbacks.", "info"); },
} satisfies Record<string, ProbeCase>;

export const componentCases = {
  ...piTuiCases,
  ...simpleMessages,
  ...interactiveCases,
  ...nativeOnlyCases,
  "opaque-component": (ctx: ExtensionCommandContext) => open(ctx, "opaque-component", () => new OpaqueProbe()),
  "all-loaders-lifecycle": async (ctx: ExtensionCommandContext) => {
    await open(ctx, "Loader lifecycle", (tui, theme) => new Loader(tui, theme.fg.bind(theme, "accent"), theme.fg.bind(theme, "muted"), "loader starts and is disposed"));
    await open(ctx, "CancellableLoader lifecycle", (tui, theme) => {
      const loader = new CancellableLoader(tui, theme.fg.bind(theme, "accent"), theme.fg.bind(theme, "muted"), "Esc aborts and disposes");
      loader.onAbort = () => ctx.ui.notify("CancellableLoader lifecycle onAbort", "info");
      return loader;
    });
  },
} satisfies Record<string, ProbeCase>;

export const tuiComponentCoverage = {
  Box: "tui-box",
  CancellableLoader: "tui-cancellable-loader",
  Editor: "tui-editor",
  HStack: "tui-hstack",
  Image: "tui-image",
  Input: "tui-input",
  Loader: "tui-loader",
  Markdown: "tui-markdown",
  MouseRegion: "tui-mouse-region",
  ScrollView: "tui-scroll-view",
  SelectList: "tui-select-list",
  SettingsList: "tui-settings-list",
  Spacer: "tui-spacer",
  Text: "tui-text",
  TruncatedText: "tui-truncated-text",
  VStack: "tui-vstack",
} satisfies Record<string, keyof typeof componentCases>;

export const piComponentCoverage = {
  ArminComponent: "pi-armin",
  AssistantMessageComponent: "pi-assistant-message",
  BashExecutionComponent: "pi-bash-execution",
  BorderedLoader: "pi-bordered-loader",
  BranchSummaryMessageComponent: "pi-branch-summary",
  CompactionSummaryMessageComponent: "pi-compaction-summary",
  CustomEditor: "pi-custom-editor",
  CustomMessageComponent: "pi-custom-message",
  DynamicBorder: "pi-dynamic-border",
  ExtensionEditorComponent: "pi-extension-editor",
  ExtensionInputComponent: "pi-extension-input",
  ExtensionSelectorComponent: "pi-extension-selector",
  FooterComponent: "pi-footer",
  LoginDialogComponent: "pi-login-dialog",
  ModelSelectorComponent: "pi-model-selector",
  OAuthSelectorComponent: "pi-oauth-selector",
  SessionSelectorComponent: "pi-session-selector",
  SettingsSelectorComponent: "pi-settings-selector",
  ShowImagesSelectorComponent: "pi-show-images-selector",
  SkillInvocationMessageComponent: "pi-skill-message",
  ThemeSelectorComponent: "pi-theme-selector",
  ThinkingSelectorComponent: "pi-thinking-selector",
  ToolExecutionComponent: "pi-tool-execution",
  TreeSelectorComponent: "pi-tree-selector",
  UserMessageComponent: "pi-user-message",
  UserMessageSelectorComponent: "pi-user-message-selector",
} satisfies Record<string, keyof typeof componentCases>;

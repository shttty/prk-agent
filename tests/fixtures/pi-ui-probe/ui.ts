import type {
  ExtensionCommandContext,
  ExtensionUIContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import {
  CustomEditor,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { CombinedAutocompleteProvider, matchesKey, type OverlayAnchor, type OverlayHandle, type TUI } from "@earendil-works/pi-tui";
import type { ProbeCase } from "./probe-types.ts";

const line = (ctx: ExtensionCommandContext, text: string) => ctx.ui.notify(text, "info");

class ProbeEditor extends CustomEditor {
  override handleInput(data: string): void {
    if (matchesKey(data, "ctrl+p")) {
      this.setText(`${this.getText()} [custom-editor]`);
      return;
    }
    super.handleInput(data);
  }
}

class ProbeCustomComponent {
  private ticks = 0;
  private timer: NodeJS.Timeout;
  private readonly tui: TUI;
  private readonly done: (value: string) => void;
  private readonly theme: Theme;
  private readonly onDispose: () => void;
  constructor(tui: TUI, done: (value: string) => void, theme: Theme, onDispose: () => void) {
    this.tui = tui;
    this.done = done;
    this.theme = theme;
    this.onDispose = onDispose;
    this.timer = setInterval(() => { this.ticks++; this.tui.requestRender(); }, 250);
  }
  handleInput(data: string): void {
    if (matchesKey(data, "return")) this.done(`done ticks=${this.ticks}`);
    if (matchesKey(data, "escape")) this.done("cancelled");
    if (matchesKey(data, "ctrl+r")) { this.ticks++; this.tui.requestRender(true); }
  }
  invalidate(): void {}
  render(width: number): string[] {
    return [this.theme.fg("accent", `CUSTOM overlay ticks=${this.ticks}`), "Enter=done Esc=cancel Ctrl+R=render", `width=${width}`];
  }
  dispose(): void { clearInterval(this.timer); this.onDispose(); }
}

export const overlayAnchors = {
  center: true, "top-left": true, "top-right": true, "bottom-left": true, "bottom-right": true,
  "top-center": true, "bottom-center": true, "left-center": true, "right-center": true,
} satisfies Record<OverlayAnchor, boolean>;


const uiCases = {
  select: async (ctx) => { line(ctx, `select=${await ctx.ui.select("probe select", ["alpha", "beta", "gamma"] ) ?? "cancel"}`); },
  confirm: async (ctx) => { line(ctx, `confirm=${await ctx.ui.confirm("probe confirm", "Choose yes or no")}`); },
  input: async (ctx) => { line(ctx, `input=${await ctx.ui.input("probe input", "type here") ?? "cancel"}`); },
  editor: async (ctx) => { line(ctx, `editor=${(await ctx.ui.editor("probe editor", "prefilled")) ?? "cancel"}`); },
  dialog_timeout: async (ctx, arg) => {
    const options = { timeout: 2500 };
    const result = arg === "select" ? await ctx.ui.select("probe timeout select", ["alpha", "beta"], options)
      : arg === "confirm" ? await ctx.ui.confirm("probe timeout confirm", "Wait for countdown", options)
      : await ctx.ui.input("probe timeout input", "Wait for countdown", options);
    line(ctx, `timeout ${arg || "input"}=${JSON.stringify(result) ?? "undefined"}`);
  },
  dialog_signal: async (ctx, arg) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const options = { signal: controller.signal };
    try {
      const result = arg === "select" ? await ctx.ui.select("probe signal select", ["alpha", "beta"], options)
        : arg === "input" ? await ctx.ui.input("probe signal input", "Wait for abort", options)
        : await ctx.ui.confirm("probe signal confirm", "Wait for abort", options);
      line(ctx, `signal ${arg || "confirm"}=${JSON.stringify(result) ?? "undefined"}`);
    } finally { clearTimeout(timer); }
  },
  notify: (ctx) => { ctx.ui.notify("probe info", "info"); ctx.ui.notify("probe warning", "warning"); ctx.ui.notify("probe error", "error"); },
  terminal_input: (ctx) => { const off = ctx.ui.onTerminalInput((data) => { ctx.ui.notify(`raw input ${JSON.stringify(data)}`, "info"); off(); return { consume: false, data }; }); line(ctx, "onTerminalInput armed: type one key"); },
  status: (ctx) => { ctx.ui.setStatus("pi-ui-probe", "status is set; run /probe status-clear"); },
  "status-clear": (ctx) => { ctx.ui.setStatus("pi-ui-probe", undefined); line(ctx, "status cleared"); },
  working: (ctx) => { ctx.ui.setWorkingMessage("probe working message"); ctx.ui.setWorkingVisible(true); ctx.ui.setWorkingIndicator({ frames: ["◐", "◓", "◑", "◒"], intervalMs: 120 }); line(ctx, "working message/visible/indicator set; run /probe working-reset"); },
  "working-reset": (ctx) => { ctx.ui.setWorkingMessage(); ctx.ui.setWorkingVisible(true); ctx.ui.setWorkingIndicator(); line(ctx, "working settings restored"); },
  thinking: (ctx) => { ctx.ui.setHiddenThinkingLabel("probe hidden thinking"); line(ctx, "hidden thinking label set; run /probe thinking-reset"); },
  "thinking-reset": (ctx) => { ctx.ui.setHiddenThinkingLabel(); line(ctx, "hidden thinking label restored"); },
  widget_above: (ctx) => { ctx.ui.setWidget("probe-widget", ["above widget line 1", "above widget line 2"], { placement: "aboveEditor" }); line(ctx, "above widget set; run /probe widget-below or widget-clear"); },
  widget_below: (ctx) => { ctx.ui.setWidget("probe-widget", ["below widget line 1", "below widget line 2"], { placement: "belowEditor" }); line(ctx, "below widget replaced above widget"); },
  widget_factory: (ctx) => { ctx.ui.setWidget("probe-widget", (_tui, theme) => ({ render: () => [theme.fg("success", "widget factory")], invalidate: () => {}, dispose: () => ctx.ui.setStatus("probe-lifecycle", "widget factory disposed") }), { placement: "aboveEditor" }); line(ctx, "component-factory widget set"); },
  "widget-clear": (ctx) => { ctx.ui.setWidget("probe-widget", undefined); line(ctx, "widget cleared"); },
  custom_overlay: async (ctx) => { const result = await ctx.ui.custom<string>((tui, theme, _keys, done) => new ProbeCustomComponent(tui, done, theme, () => ctx.ui.setStatus("probe-lifecycle", "overlay disposed")), { overlay: true, overlayOptions: { anchor: "top-right", width: "50%", minWidth: 30, maxHeight: "50%", margin: { top: 1, right: 2, bottom: 1, left: 2 }, offsetX: -1, offsetY: 1, nonCapturing: false, visible: (w, h) => w > 20 && h > 5 }, onHandle: (handle) => { ctx.ui.notify(`overlay handle hidden=${handle.isHidden()}`, "info"); } }); line(ctx, `overlay=${result}`); },
  custom_editor: async (ctx) => { const result = await ctx.ui.custom<string>((tui, theme, _keys, done) => new ProbeCustomComponent(tui, done, theme, () => ctx.ui.setStatus("probe-lifecycle", "editor replacement disposed")), { overlay: false }); line(ctx, `editor replacement=${result}`); },
  overlay_controls: async (ctx, arg) => {
    const anchor = Object.keys(overlayAnchors).find((key) => key === arg) as OverlayAnchor | undefined;
    const result = await ctx.ui.custom<string>((tui, theme, _keys, done) => {
      let second: OverlayHandle;
      const handleInput = (data: string) => {
        if (data === "h") second.setHidden(!second.isHidden());
        if (data === "f") second.focus();
        if (data === "u") second.unfocus();
        if (matchesKey(data, "escape")) done("closed");
        tui.requestRender();
      };
      const timer = setInterval(() => tui.requestRender(), 300);
      second = tui.showOverlay({
        render: () => [theme.bg("selectedBg", `SECOND nonCapturing focus=${second.isFocused()}`), "f=focus u=unfocus h=hide Esc=close"],
        handleInput, invalidate() {},
      }, { width: "45%", anchor: "center", offsetX: 5, offsetY: 1, nonCapturing: true });
      return {
        render: () => [theme.fg("accent", `PRIMARY anchor=${anchor ?? "center"} secondHidden=${second.isHidden()}`),
          "h=toggle second f=focus second u=unfocus Esc=done", ...Array.from({ length: 12 }, (_, i) => `maxHeight clipped line ${i}`)],
        handleInput, invalidate() {},
        dispose() { clearInterval(timer); second.hide(); line(ctx, "overlay controls disposed"); },
      };
    }, { overlay: true, overlayOptions: { anchor: anchor ?? "center", width: "60%", maxHeight: 6, margin: 2 } });
    line(ctx, `overlay controls ${result}`);
  },
  overlay_position: async (ctx) => {
    await ctx.ui.custom<string>((tui, theme, _keys, done) => new ProbeCustomComponent(tui, done, theme, () => line(ctx, "position overlay disposed")), {
      overlay: true, overlayOptions: () => ({ width: "40%", maxHeight: "25%", row: "25%", col: "30%", margin: 1 }),
    });
  },
  "working-hide": (ctx) => { ctx.ui.setWorkingVisible(false); line(ctx, "working hidden; trigger a model turn"); },
  "working-none": (ctx) => { ctx.ui.setWorkingIndicator({ frames: [] }); line(ctx, "working indicator frames=[]; trigger a model turn"); },
  "working-static": (ctx) => { ctx.ui.setWorkingIndicator({ frames: ["PROBE-STATIC"] }); line(ctx, "working indicator static; trigger a model turn"); },
  editor_component: (ctx) => { ctx.ui.setEditorComponent((tui, theme, keys) => new ProbeEditor(tui, theme, keys)); line(ctx, "setEditorComponent called (PRK web ignores it)"); },
  editor_text: (ctx) => { ctx.ui.setEditorText("probe editor text"); line(ctx, `getEditorText=${ctx.ui.getEditorText()}`); },
  paste: (ctx) => { ctx.ui.pasteToEditor("pasted probe text"); line(ctx, "pasteToEditor called"); },
  autocomplete: (ctx) => {
    ctx.ui.addAutocompleteProvider((current) => {
      const probe = new CombinedAutocompleteProvider([{ value: "probe-completion", label: "probe-completion", description: "additional provider" }], ctx.cwd);
      return {
        getSuggestions: async (lines, row, col, options) => (await probe.getSuggestions(lines, row, col, options)) ?? current.getSuggestions(lines, row, col, options),
        applyCompletion: (lines, row, col, item, prefix) => current.applyCompletion(lines, row, col, item, prefix),
        shouldTriggerFileCompletion: (lines, row, col) => current.shouldTriggerFileCompletion?.(lines, row, col) ?? false,
      };
    });
    line(ctx, "additional provider set: type /probe-completion");
  },
  footer: (ctx) => { ctx.ui.setFooter((_tui, theme, footer) => ({ render: (width) => [theme.fg("accent", `probe footer width=${width} branch=${footer.getGitBranch() ?? "none"}`)], invalidate: () => {}, dispose: () => ctx.ui.setStatus("probe-lifecycle", "footer disposed") })); line(ctx, "custom footer set; run /probe footer-reset"); },
  "footer-reset": (ctx) => { ctx.ui.setFooter(undefined); line(ctx, "footer restored"); },
  header: (ctx) => { ctx.ui.setHeader((_tui, theme) => ({ render: () => [theme.fg("accent", "probe custom header")], invalidate: () => {}, dispose: () => ctx.ui.setStatus("probe-lifecycle", "header disposed") })); line(ctx, "custom header set; run /probe header-reset"); },
  "header-reset": (ctx) => { ctx.ui.setHeader(undefined); line(ctx, "header restored"); },
  title: (ctx) => { ctx.ui.setTitle("pi-ui-probe title"); line(ctx, "terminal title set"); },
  themes: (ctx) => { line(ctx, `theme=${ctx.ui.theme.name ?? "unnamed"} available=${ctx.ui.getAllThemes().map((x) => x.name).join(",")}`); },
  "theme-get": (ctx, arg) => { const theme = ctx.ui.getTheme(arg || "system"); line(ctx, `getTheme(${arg || "system"})=${theme?.name ?? "undefined"}`); },
  "theme-set": (ctx, arg) => { const result = ctx.ui.setTheme(arg || "system"); line(ctx, `setTheme(${arg || "system"})=${result.success ? "ok" : result.error}`); },
  tools_expanded: (ctx) => { const before = ctx.ui.getToolsExpanded(); ctx.ui.setToolsExpanded(!before); line(ctx, `toolsExpanded ${before} -> ${ctx.ui.getToolsExpanded()}; run again to restore`); },
  editor_factory: (ctx) => { line(ctx, `getEditorComponent=${ctx.ui.getEditorComponent() ? "custom" : "default"}`); },
} satisfies Record<string, ProbeCase>;

export const uiCaseTable: Record<string, ProbeCase> = uiCases;

export const uiCoverage = {
  select: "select", confirm: "confirm", input: "input", editor: "editor", notify: "notify",
  onTerminalInput: "terminal_input", setStatus: "status", setWorkingMessage: "working",
  setWorkingVisible: "working", setWorkingIndicator: "working", setHiddenThinkingLabel: "thinking",
  setWidget: "widget_factory", setFooter: "footer", setHeader: "header", setTitle: "title",
  custom: "custom_overlay", pasteToEditor: "paste", setEditorText: "editor_text", getEditorText: "editor_text",
  addAutocompleteProvider: "autocomplete", setEditorComponent: "editor_component", getEditorComponent: "editor_factory",
  theme: "themes", getAllThemes: "themes", getTheme: "theme-get", setTheme: "theme-set",
  getToolsExpanded: "tools_expanded", setToolsExpanded: "tools_expanded",
} satisfies Record<keyof ExtensionUIContext, keyof typeof uiCases>;

export function registerUiCases(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus("pi-ui-probe", "loaded; /probe help");
  });
}

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeRendererFixture(agentDir) {
  await writeFile(join(agentDir, "extensions", "renderer-boundaries.js"), `
  import { Input, SelectList, SettingsList, Text } from ${JSON.stringify(import.meta.resolve("@earendil-works/pi-tui"))};
  export default function(pi) {
    const base = { label: "renderer boundary", description: "isolated renderer acceptance", parameters: { type: "object", properties: {} },
      async execute() { return { content: [{ type: "text", text: "NATIVE_RENDERER_FALLBACK" }] }; } };
    pi.registerTool({ ...base, name: "renderer_throw", renderShell: "self",
      renderCall() { throw new Error("CALL_RENDERER_FAILURE"); }, renderResult() { throw new Error("RESULT_RENDERER_FAILURE"); } });
    pi.registerTool({ ...base, name: "renderer_width", renderShell: "self",
      renderResult() { return { render(width) { return ["X".repeat(width)]; }, invalidate() {} }; } });
    pi.registerTool({ ...base, name: "renderer_plain", parameters: { type: "object", properties: { note: { type: "string" } } } });
    pi.registerTool({ ...base, name: "renderer_multiline", renderCall() { return new Text("MULTI_FIRST\\nMULTI_SECOND", 0, 0); } });
    pi.registerTool({ ...base, name: "renderer_short", renderCall() { return new Text("SHORT_CALL", 0, 0); }, renderResult() { return new Text("SHORT_RESULT", 0, 0); } });
    let created = 0, disposed = 0;
    const owned = () => { created++; return { render: () => ["LIFETIME_RENDERER"], invalidate() {}, dispose() { disposed++; } }; };
    pi.registerMessageRenderer("lifetime-message", owned);
    pi.registerEntryRenderer("lifetime-entry", owned);
    pi.registerMessageRenderer("throw-message", () => { throw new Error("MESSAGE_RENDERER_FAILURE"); });
    pi.registerEntryRenderer("throw-entry", () => { throw new Error("ENTRY_RENDERER_FAILURE"); });
    pi.registerCommand("renderer-lifetime", { description: "Renderer ownership acceptance", handler(argument, ctx) {
      if (argument === "start") { pi.sendMessage({ customType: "lifetime-message", content: "lifetime", display: true }); pi.appendEntry("lifetime-entry", { marker: "lifetime" }); }
      else ctx.ui.notify("LIFETIME_LIVE=" + (created - disposed));
    } });
    pi.registerCommand("renderer-errors", { description: "Renderer fallback acceptance", handler() {
      pi.sendMessage({ customType: "throw-message", content: "RAW_MESSAGE_FALLBACK", display: true });
      pi.appendEntry("throw-entry", { marker: "RAW_ENTRY_FALLBACK" });
    } });
    pi.registerCommand("bridge-custom", { description: "Native custom factory contract", async handler(kind, ctx) {
      let disposalCount = 0;
      const result = await ctx.ui.custom((tui, theme, keys, done) => {
        ctx.ui.notify("NATIVE_KEYS=" + keys.getEffectiveConfig()["app.interrupt"] + ":" + keys.matches(String.fromCharCode(7), "app.interrupt"));
        if (kind === "settings") {
          const identity = (value) => value;
          return new SettingsList([{ id: "mode", label: "Mode", currentValue: "first", values: ["first", "second"] }], 5,
            { label: identity, value: identity, description: identity, hint: identity, cursor: "> " },
            (id, value) => done(id + ":" + value), () => done(undefined));
        }
        const input = new Input();
        input.onSubmit = (value) => done(value);
        input.dispose = () => ctx.ui.setStatus("custom-disposal-count", String(++disposalCount));
        return input;
      }, { overlay: kind === "overlay", overlayOptions: { anchor: "top-right", width: "50%", minWidth: 20, maxHeight: 6, margin: { top: 1, right: 2 } } });
      ctx.ui.notify("CUSTOM_RESULT=" + result);
    } });
    pi.registerCommand("bridge-widget", { description: "Native component callback acceptance", handler(kind, ctx) {
      const identity = (value) => value;
      const selected = { selectedPrefix: identity, selectedText: identity, description: identity, scrollInfo: identity, noMatch: identity };
      ctx.ui.setWidget("native-control", () => {
        if (kind === "input") { const input = new Input(); input.onSubmit = (value) => ctx.ui.notify("WIDGET_INPUT=" + value); return input; }
        if (kind === "select" || kind === "filtered") { const list = new SelectList([{ value: "alpha", label: "Alpha" }, { value: "beta", label: "Beta" }, { value: "gamma", label: "Gamma" }], 5, selected); if (kind === "filtered") list.setFilter("g"); list.onSelect = (item) => ctx.ui.notify("WIDGET_SELECT=" + item.value); return list; }
        if (kind === "submenu") return new SettingsList([{ id: "mode", label: "Mode", currentValue: "parent", submenu(value, close) { const input = new Input(); input.setValue(value); input.onSubmit = (next) => close(next); return input; } }], 5,
          { ...selected, label: identity, value: identity, selectedLabel: identity, selectedValue: identity }, (id, value) => ctx.ui.notify("WIDGET_SUBMENU=" + id + ":" + value), () => {});
        return new SettingsList([{ id: "mode", label: "Mode", currentValue: "first", values: ["first", "second"] }], 5,
          { ...selected, label: identity, value: identity, selectedLabel: identity, selectedValue: identity }, (id, value) => ctx.ui.notify("WIDGET_SETTING=" + id + ":" + value), () => {});
      });
    } });
    // Semantic tokens, hard-coded 16 colors, 256/truecolor and text attributes in one line; the Web asserts span order.
    pi.registerCommand("bridge-ansi", { description: "ANSI semantic rendering acceptance", handler(_args, ctx) {
      const t = ctx.ui.theme;
      const line = [...["success", "error", "warning", "accent", "text", "muted", "dim", "toolDiffRemoved"].map((token) => t.fg(token, token)),
        ...[31, 92, 33, 34, 36, 95, 30, 90, 97].map((code) => "\\x1b[" + code + "mc" + code + "\\x1b[39m"),
        "\\x1b[38;5;196mp196\\x1b[39m", "\\x1b[38;2;12;34;56mrgb\\x1b[39m",
        t.style("bold", { bold: true }), "\\x1b[2mdim\\x1b[22m", t.style("italic", { italic: true }), t.style("underline", { underline: true }), t.style("strike", { strikethrough: true }),
        t.style("all", { fg: "error", bold: true, italic: true, underline: true, strikethrough: true })].join(" ");
      ctx.ui.setWidget("ansi-probe", [line]);
      ctx.ui.setStatus("ansi-probe", line);
      ctx.ui.notify(line, "warning");
    } });
  }
  `);
}

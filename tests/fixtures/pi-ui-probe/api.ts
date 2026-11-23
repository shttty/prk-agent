import type {
	AgentToolResult,
	ExtensionAPI,
	KeybindingHints,
	ToolDefinition,
	ToolRendererResolver,
} from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { ProbeCase } from "./probe-types.ts";

const ProbeParams = Type.Object({
	argument: Type.Optional(Type.String({ description: "Short probe argument" })),
});
const DefaultParams = Type.Object({
  argument: ProbeParams.properties.argument,
  hold: Type.Optional(Type.Boolean({ description: "Show a native confirmation before completing, so partial rendering can be captured." })),
});

type ProbeResult = { identity: string; argument?: string; confirmed?: boolean };

const API_METHODS = {
	registerTool: "tools",
	registerCommand: "commands + autocomplete",
	registerShortcut: "shortcut ctrl+alt+p",
	registerMessageRenderer: "message renderer",
	registerEntryRenderer: "entry renderer",
	registerToolRenderer: "tool renderer resolver",
	registerMarkdownTransformer: "markdown transformer",
	sendMessage: "sendMessage display true/false",
	sendUserMessage: "sendUserMessage",
	setSessionName: "session name",
	setLabel: "entry label",
	on: "ui_prompt_start/end + input",
} satisfies Record<keyof Pick<ExtensionAPI, "registerTool" | "registerCommand" | "registerShortcut" | "registerMessageRenderer" | "registerEntryRenderer" | "registerToolRenderer" | "registerMarkdownTransformer" | "sendMessage" | "sendUserMessage" | "setSessionName" | "setLabel" | "on">, string>;

function label(text: string) {
	return new Text(`[pi-ui-probe] ${text}`, 0, 0);
}

function resultText(result: AgentToolResult<ProbeResult>, expanded: boolean, isPartial: boolean, shell: string) {
	const details = result.details;
	return `[pi-ui-probe] ${details?.identity ?? "unknown"} shell=${shell} ${expanded ? "expanded" : "collapsed"} ${isPartial ? "partial" : "final"} argument=${details?.argument ?? "(none)"}`;
}

function hintText(options: KeybindingHints): string {
	return `keys=${options.keyText("app.tools.expand")} hint=${options.keyHint("app.tools.expand", "probe-expand")}`;
}

function renderers(identity: string, shell: "default" | "self"): Pick<ToolDefinition<typeof ProbeParams, ProbeResult>, "renderShell" | "renderCall" | "renderResult"> {
 	return {
 		renderShell: shell,
		renderCall(args, theme, context) {
			return label(theme.fg("accent", `${identity} call shell=${shell} argument=${args.argument ?? "(none)"} ${hintText(context)}`));
 		},
		renderResult(result, options, _theme, context) {
			return label(`${resultText(result, options.expanded, options.isPartial, shell)} ${hintText(context)}`);
 		},
 	};
 }
export function createApiCases(pi: ExtensionAPI): Record<string, ProbeCase> {
	const events = { promptStart: 0, promptEnd: 0, input: 0 };

	pi.registerTool({
		name: "probe_default",
		label: "Pi UI probe default renderer",
		description: "Call this tool for the pi-ui-probe renderer check. Return its result unchanged.",
    parameters: DefaultParams,
		renderShell: "default",
		...renderers("probe_default", "default"),
    async execute(_id, params, _signal, onUpdate, ctx): Promise<AgentToolResult<ProbeResult>> {
      onUpdate?.({ content: [{ type: "text", text: "[pi-ui-probe] probe_default streaming update" }], details: { identity: "probe_default", argument: params.argument } });
      const confirmed = params.hold ? await ctx.ui.confirm("probe partial result", "Capture partial rendering; Enter releases the real tool result") : undefined;
      return { content: [{ type: "text", text: "[pi-ui-probe] probe_default result" }], details: { identity: "probe_default", argument: params.argument, confirmed } };
		},
	});
	pi.registerTool({
		name: "probe_self",
		label: "Pi UI probe self renderer",
		description: "Call this tool for the self-shell pi-ui-probe renderer check. Return its result unchanged.",
		parameters: ProbeParams,
		renderShell: "self",
		...renderers("probe_self", "self"),
		async execute(_id, params): Promise<AgentToolResult<ProbeResult>> {
			return { content: [{ type: "text", text: "[pi-ui-probe] probe_self result" }], details: { identity: "probe_self", argument: params.argument } };
		},
	});
	pi.registerTool({
		name: "probe_resolved",
		label: "Pi UI probe resolver renderer",
		description: "Call this tool for the resolver pi-ui-probe renderer check. Return its result unchanged.",
		parameters: ProbeParams,
		async execute(_id, params): Promise<AgentToolResult<ProbeResult>> {
			return { content: [{ type: "text", text: "[pi-ui-probe] probe_resolved result" }], details: { identity: "probe_resolved", argument: params.argument } };
		},
	});

	const resolver: ToolRendererResolver = (toolName, next) => {
		if (toolName !== "probe_resolved") return next();
		return {
			renderShell: "default",
			renderCall: (_args, _theme, context) => label(`probe_resolved resolver call shell=default ${hintText(context)}`),
			renderResult: (result, options, _theme, context) => label(`${resultText(result as AgentToolResult<ProbeResult>, options.expanded, options.isPartial, "resolver")} ${hintText(context)}`),
		};
	};
	pi.registerToolRenderer(resolver);

	pi.registerMessageRenderer("probe-message", (message, options) => { const box = new Box(options.outputPad, 1, (text) => text); box.addChild(label(`[message renderer] expanded=${options.expanded} ${message.content} ${hintText(options)}`)); return box; });
	pi.registerEntryRenderer("probe-entry", (entry, options) => label(`[entry renderer] expanded=${options.expanded} data=${JSON.stringify(entry.data)} ${hintText(options)}`));
	pi.registerMarkdownTransformer((markdown, context) => `${markdown} [markdown-transformer:${context.messageType}:${context.isStreaming ? "streaming" : "final"}]`);

	pi.registerCommand("probe-api-command", {
		description: "Pi UI probe command (argument autocomplete)",
		getArgumentCompletions: (prefix) => ["message", "entry", "send", "user", "name", "events", "tools"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: `probe ${value}` })),
		handler: async (args, ctx) => {
			ctx.ui.notify(`[pi-ui-probe] command args=${args || "(none)"}`, "info");
		},
	});
	pi.registerShortcut("ctrl+alt+p", {
		description: "Pi UI probe shortcut",
		handler: (ctx) => ctx.ui.notify("[pi-ui-probe] shortcut ctrl+alt+p", "info"),
	});
	pi.on("ui_prompt_start", (event, ctx) => {
		events.promptStart++;
		ctx.ui.setStatus("pi-ui-probe", `[probe events] prompt-start ${event.kind} count=${events.promptStart}`);
	});
 	pi.on("ui_prompt_end", (event, ctx) => {
 		events.promptEnd++;
		ctx.ui.setStatus("pi-ui-probe", `[probe events] prompt-end ${event.kind} count=${events.promptEnd}`);
 	});
	pi.on("input", (event, ctx) => {
		if (!event.text.startsWith("probe-input-marker")) return { action: "continue" as const };
		events.input++;
		ctx.ui.notify(`[probe events] input marker source=${event.source} count=${events.input}`, "info");
		return { action: "handled" as const };
	});
	pi.on("turn_end", (event) => {
		if (event.messageEntryId) pi.setLabel(event.messageEntryId, "pi-ui-probe turn");
	});

	return {
		"api-methods": async (ctx) => ctx.ui.notify(`[pi-ui-probe] API coverage: ${Object.values(API_METHODS).join(" | ")}`, "info"),
    "tool-renderers": async (ctx) => ctx.ui.notify("[pi-ui-probe] /probe send-user-message calls the three real tools; probe_default hold=true opens a confirmation while renderResult is partial. Capture, then Enter releases final result.", "info"),
		"command-autocomplete": async (ctx) => ctx.ui.notify("[pi-ui-probe] Type /probe-api-command then press Tab; completions: message, entry, send, user, name, events, tools.", "info"),
		"shortcut": async (ctx) => ctx.ui.notify("[pi-ui-probe] Press Ctrl+Alt+P (shortcut is registered).", "info"),
		"message-renderer": async () => pi.sendMessage({ customType: "probe-message", content: "display=true custom message", display: true, details: { probe: true } }),
		"message-hidden": async () => pi.sendMessage({ customType: "probe-message", content: "display=false custom message (hidden)", display: false, details: { probe: true } }),
		"entry-renderer": async (ctx) => { pi.appendEntry("probe-entry", { marker: "native entry renderer; inspect /tree label" }); ctx.ui.notify("[pi-ui-probe] appended probe-entry; inspect /tree for the labeled transcript entry.", "info"); },
    "send-user-message": async (_ctx, argument) => pi.sendUserMessage(argument || "[pi-ui-probe] Call probe_default with argument 'default' and hold=true, probe_self with argument 'self', and probe_resolved with argument 'resolved', once each. Then reply briefly with **probe complete**. Do nothing else."),
		"session-name-label": async (ctx) => { pi.setSessionName("pi-ui-probe session"); ctx.ui.notify(`[pi-ui-probe] session name=${pi.getSessionName() ?? "(missing)"}; latest turn entries receive label 'pi-ui-probe turn'.`, "info"); },
    "prompt-events": async (ctx) => ctx.ui.notify("[pi-ui-probe] Use /probe input and watch prompt-start/end status; submit probe-input-marker to see handled input without a model turn.", "info"),
		"markdown-transformer": async (ctx) => { pi.sendMessage({ customType: "probe-message", content: "markdown transformer marker: **probe**", display: true }); ctx.ui.notify("[pi-ui-probe] Markdown transformer appends [markdown-transformer:kind:streaming/final] to user/assistant transcript markdown.", "info"); },
	};
}

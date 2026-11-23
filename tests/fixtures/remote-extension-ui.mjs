// Controlled target-side extension for the real remote-host/Gateway/browser acceptance.
import { readFileSync } from "node:fs";

const packageVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

export default function remoteExtensionUi(pi) {
  let factoryCalls = 0;
  let rendererCalls = 0;
  const componentFactory = () => {
    factoryCalls++;
    throw new Error("RPC component factories must not be invoked");
  };
  const renderer = () => {
    rendererCalls++;
    throw new Error("RPC renderers must not be invoked");
  };
  pi.registerMessageRenderer("remote-ui-message", renderer);
  pi.registerEntryRenderer("remote-ui-entry", renderer);
  pi.registerToolRenderer(() => {
    rendererCalls++;
    return { renderCall: renderer, renderResult: renderer };
  });
  pi.registerTool({
    name: "remote_ui",
    label: "Remote UI acceptance",
    description: "Exercise the Pi RPC UI subset in the owned target process.",
    parameters: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["data", "clear", "select", "confirm", "input", "editor", "unsupported"] },
        token: { type: "string" },
        timeoutMs: { type: "integer", minimum: 1 },
        abortAfterMs: { type: "integer", minimum: 1 },
        preAborted: { type: "boolean" },
      },
      required: ["operation", "token"],
      additionalProperties: false,
    },
    renderCall: renderer,
    renderResult: renderer,
    async execute(_id, args, signal, _onUpdate, ctx) {
      const controller = new AbortController();
      if (args.preAborted) controller.abort(new Error("remote-ui pre-aborted"));
      const timer = args.abortAfterMs === undefined ? undefined
        : setTimeout(() => controller.abort(new Error("remote-ui dialog abort")), args.abortAfterMs);
      const options = {
        signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
        ...(args.timeoutMs === undefined ? {} : { timeout: args.timeoutMs }),
      };
      let value;
      let themeError;
      try {
        switch (args.operation) {
          case "data":
            ctx.ui.notify(`REMOTE_NOTICE:${args.token}`, "warning");
            ctx.ui.setStatus("remote-ui", `REMOTE_STATUS:${args.token}`);
            ctx.ui.setWidget("remote-ui-above", [`REMOTE_WIDGET_ABOVE:${args.token}`, "target text widget"], { placement: "aboveEditor" });
            ctx.ui.setWidget("remote-ui-below", [`REMOTE_WIDGET_BELOW:${args.token}`], { placement: "belowEditor" });
            ctx.ui.setTitle(`REMOTE_TITLE:${args.token}`);
            ctx.ui.setEditorText(`REMOTE_EDITOR:${args.token}`);
            break;
          case "clear":
            ctx.ui.setStatus("remote-ui", undefined);
            ctx.ui.setWidget("remote-ui-above", undefined);
            ctx.ui.setWidget("remote-ui-below", undefined);
            ctx.ui.setTitle("");
            ctx.ui.setEditorText("");
            break;
          case "select":
            value = await ctx.ui.select(`REMOTE_SELECT:${args.token}`, ["remote-alpha", "remote-beta"], options);
            break;
          case "confirm":
            value = await ctx.ui.confirm(`REMOTE_CONFIRM:${args.token}`, `REMOTE_MESSAGE:${args.token}`, options);
            break;
          case "input":
            value = await ctx.ui.input(`REMOTE_INPUT:${args.token}`, "remote input", options);
            break;
          case "editor":
            // Pi's public editor method has no timeout/signal options; turn cancellation is tested separately.
            value = await ctx.ui.editor(`REMOTE_EDITOR_DIALOG:${args.token}`, `REMOTE_PREFILL:${args.token}`);
            break;
          case "unsupported":
            ctx.ui.setWidget("remote-ui-factory", componentFactory);
            ctx.ui.setFooter(componentFactory);
            ctx.ui.setHeader(componentFactory);
            ctx.ui.setEditorComponent(componentFactory);
            value = await ctx.ui.custom(componentFactory, { overlay: true });
            if (ctx.ui.getEditorComponent() !== undefined) throw new Error("RPC editor component must remain undefined");
            try { void ctx.ui.theme; } catch (error) { themeError = error.message; }
            if (!themeError) throw new Error("Unsupported RPC ui.theme must fail explicitly");
            break;
          default:
            throw new Error(`Unexpected remote UI operation: ${args.operation}`);
        }
        const details = {
          fixture: "remote-extension-ui",
          operation: args.operation,
          token: args.token,
          value,
          valueType: typeof value,
          pid: process.pid,
          packageVersion,
          cwd: process.cwd(),
          marker: process.env.PRK_REMOTE_UI_MARKER,
          mode: ctx.mode,
          hasUI: ctx.hasUI,
          sessionId: ctx.sessionManager.getSessionId(),
          factoryCalls,
          rendererCalls,
          themeError,
          dialogSignalAborted: options.signal.aborted,
          toolSignalAborted: signal?.aborted ?? false,
        };
        return { content: [{ type: "text", text: JSON.stringify(details) }], details };
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";
import { WireError } from "../wire/create-error.ts";

export function workspace(ctx: HostContext, method: Parameters<GatewaySessionHost["workspace"]>[0], sessionId: Parameters<GatewaySessionHost["workspace"]>[1], p: Parameters<GatewaySessionHost["workspace"]>[2]): ReturnType<GatewaySessionHost["workspace"]> {
      // Gateway owns PTYs independently of SDK runtime transitions.
      // Listing, typing, interrupting, resizing and closing use their existing in-memory handles.
      if (method === "terminalsList" || method === "terminalInput" || method === "terminalInterrupt" || method === "terminalResize" || method === "terminalClose") {
        ctx.methods.storedSession(sessionId);
        return ctx.methods.runtimeChange(async () => {
          switch (method) {
            case "terminalsList": return { terminals: ctx.workspace.modelTerminals.get(sessionId)?.getSnapshot() ?? ctx.workspace.terminals.list(sessionId).terminals };
            case "terminalInput": return ctx.workspace.terminals.input(sessionId, p.name as string, p.data as string);
            case "terminalInterrupt": return ctx.workspace.modelTerminals.get(sessionId)?.interrupt(p.name as string, p.generation as string, p.commandId as string) ?? { requested: false };
            case "terminalResize": return ctx.workspace.terminals.resize(sessionId, p.name as string, p.rows as number, p.cols as number);
            default: return ctx.workspace.terminals.close(sessionId, p.name as string);
          }
        });
      }
      if (method.startsWith("files")) {
        const current = ctx.methods.storedSession(sessionId);
        if (p.target !== current.target) throw new WireError("INVALID_REQUEST", "Session execution target changed; refresh its selection before another file operation.", { reason: "target-mismatch", target: current.target });
      }
      const context = ctx.methods.workspaceContext(sessionId, method === "terminalOpen" && !ctx.workspace.terminals.has(sessionId, p.name as string));
      return ctx.methods.runtimeChange(async () => {
        switch (method) {
          case "filesList": return ctx.workspace.files.list(context, p.path as string | undefined);
          case "filesDownload":
            // Allow for base64 padding plus the bounded Gateway response envelope and its newline.
            return ctx.workspace.files.download(context, p.path as string, Math.floor((ctx.host.config.limits.outputBytes - 128) / 4) * 3, p.inlineImage === true);
          case "filesUpload":
            return ctx.workspace.files.upload(context, p.path as string, p.overwrite as boolean, Math.floor((ctx.host.config.limits.inputBytes - 128) / 4) * 3);
          case "filesRead": return ctx.workspace.files.read(context, p.path as string, p.format as "text" | "base64" | undefined);
          case "filesWrite": return ctx.workspace.files.write(context, p as unknown as Parameters<typeof ctx.workspace.files.write>[1]);
          case "filesCreate": return ctx.workspace.files.create(context, p as unknown as Parameters<typeof ctx.workspace.files.create>[1]);
          case "filesRename": return ctx.workspace.files.rename(context, p.path as string, p.newPath as string);
          case "filesCopy": return ctx.workspace.files.copy(context, p.path as string, p.toDir as string);
          case "filesDelete": return ctx.workspace.files.delete(context, p.path as string);
          case "terminalOpen": return ctx.workspace.terminals.open(sessionId, context, p.name as string);
          default: throw new Error("Terminal subscriptions require an observation connection.");
        }
      });
    }

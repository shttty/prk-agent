import { validateWorkspaceRequest } from "../../requests/validate-workspace-request.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import xterm from "@xterm/headless";
import { preserveScrollback } from "../output/preserve-scrollback.ts";
import { osc } from "../commands/handle-shell-marker.ts";
import { enqueue } from "../stream/enqueue-terminal-event.ts";
import { dispose } from "./dispose.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { timer } from "../timing/start-timer.ts";
import { createModelBashCommand } from "../../terminals/shell/model-bash.ts";

export async function open(ctx: ModelTerminalsContext, name: string, replacing = false, requestedOwner?: "model" | "human"): Promise<ModelTerminal> {
    if (ctx.stopped) throw new WireError("UNAVAILABLE", "Model terminals are closed.");
    if (!replacing) {
      await ctx.restartTasks.get(name);
      const failure = ctx.restartErrors.get(name);
      if (failure) throw failure;
    }
    if (!validateWorkspaceRequest("terminalOpen", { sessionId: ctx.sessionId, name }, ctx.limits)) throw new WireError("INVALID_REQUEST", "Terminal name must satisfy the workspace identifier limits.");
    const existing = ctx.entries.get(name);
    if (existing && !existing.closed) { await existing.ready; await existing.parsed; return existing; }
    const opening = ctx.openings.get(name);
    if (opening) return opening;
    const task = (async () => {
      if (existing) dispose(ctx, existing);
      const listed = ctx.terminals.list(ctx.sessionId).terminals.find((candidate) => candidate.name === name);
      const owner = requestedOwner ?? (listed && listed.owner !== "model" ? "human" : "model");
      let snapshot;
      if (owner === "human") {
        snapshot = await ctx.terminals.open(ctx.sessionId, ctx.context, name);
      } else {
        const environment = Object.entries(ctx.environment ?? {}).map(([key, value]) => `${key}=${value}`);
        const command = createModelBashCommand(ctx.options.modelHistoryFile);
        const shellCommand = environment.length ? ["env", ...environment, ...command] : command;
        snapshot = await ctx.terminals.open(ctx.sessionId, ctx.context, name, { owner: "model", label: name, shellCommand });
      }
      const integration = owner === "human" ? await ctx.terminals.integration(ctx.sessionId, name) : "unavailable";
      const ready = Promise.withResolvers<void>();
      const terminal = new xterm.Terminal({ cols: snapshot.cols, rows: snapshot.rows,
        scrollback: ctx.options.scrollbackLines, scrollOnEraseInDisplay: true, allowProposedApi: true, logLevel: "off" });
      const entry: ModelTerminal = { name, owner, integration, terminal, cwd: ctx.context.cwd, quietNotify: ctx.options.quietNotifyDefault,
        outputBrake: ctx.options.outputBrakeDefault, pendingOutput: "", promptColumn: 0, ready: ready.promise,
        resolveReady: () => { entry.integration = "ready"; clearTimeout(entry.readyTimer); ready.resolve(); },
        rejectReady: (error) => { clearTimeout(entry.readyTimer); ready.reject(error); },
        parsed: Promise.resolve(), unsubscribe: () => {}, closed: false, disposed: false, suppress: false, replaying: true };
      ctx.entries.set(name, entry);
      // A rejected readiness promise is also observed by the opening caller.
      void entry.ready.catch(() => undefined);
      terminal.parser.registerCsiHandler({ final: "J" }, (params) => params[0] === 3);
      terminal.parser.registerOscHandler(133, (data) => osc(ctx, entry, data));
      terminal.parser.registerOscHandler(7, (data) => {
        if (data.startsWith("file://")) {
          const slash = data.indexOf("/", 7);
          if (slash >= 0) { entry.cwd = data.slice(slash); if (entry.current?.status === "running") entry.current.cwd = entry.cwd; }
        }
        return true;
      });
      terminal.onLineFeed(() => preserveScrollback(ctx, entry));
      // Public terminal device replies (DA/DSR, etc.) go back to this PTY only.
      terminal.onData((data) => { if (!entry.closed && !entry.replaying && !ctx.stopped) ctx.terminals.input(ctx.sessionId, name, data); });
      const subscription = ctx.terminals.subscribe(ctx.sessionId, name, (event) => enqueue(ctx, entry, event));
      entry.unsubscribe = subscription.unsubscribe;
      enqueue(ctx, entry, { type: "stdout", data: subscription.snapshot.replay });
      await entry.parsed;
      entry.replaying = false;
      if (owner === "human") {
        await entry.parsed;
        ready.resolve();
      } else {
        entry.readyTimer = timer(() => entry.rejectReady(new WireError("UNAVAILABLE", "Bash shell integration did not become ready.")), 10_000);
        // Replay may already contain the readiness marker.
        if (entry.prompt) entry.resolveReady();
      }
      await entry.ready;
      if (ctx.stopped) throw new WireError("UNAVAILABLE", "Model terminals closed while opening.");
      return entry;
    })().catch(async (error: unknown) => {
      const failed = ctx.entries.get(name);
      if (failed) { dispose(ctx, failed); ctx.entries.delete(name); }
      if (ctx.terminals.list(ctx.sessionId).terminals.some((candidate) => candidate.name === name && candidate.owner === "model")) await ctx.terminals.close(ctx.sessionId, name);
      throw error;
    }).finally(() => { ctx.openings.delete(name); });
    ctx.openings.set(name, task);
    return task;
  }

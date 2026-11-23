import { openTerminal } from "@earendil-works/pi-env";
import { WireError } from "../../gateway/wire/create-error.ts";
import { HUMAN_BASH_COMMAND } from "../terminals/shell/human-bash.ts";
import type { PtyContext, PtyEntry } from "./terminal-state.ts";
import { receiveOutput } from "./receive-output.ts";
import { retireTerminal } from "./retire-terminal.ts";
import { readFileSync } from "node:fs";

const wrapperSource = readFileSync(new URL("./run-shell.py", import.meta.url), "utf8");

export async function startTerminal(ctx: PtyContext, entry: PtyEntry, cwd: string): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const lease = await ctx.options.acquire(entry.target);
    entry.lease = lease;
    if (entry.closed || lease.signal.aborted) {
      await lease.release();
      throw new WireError("UNAVAILABLE", "Terminal connection ended before creation.");
    }
    const aborted = () => retireTerminal(ctx, entry, lease.signal.reason);
    lease.signal.addEventListener("abort", aborted, { once: true });
    entry.stopAbort = () => lease.signal.removeEventListener("abort", aborted);
    entry.daemonSession = await lease.connection.session();
    if (entry.closed || lease.signal.aborted) throw new WireError("UNAVAILABLE", "Terminal connection ended before creation.");
    const runtime = entry.runtime = await ctx.options.runtime(entry.target, lease);
    if (entry.closed || lease.signal.aborted) throw new WireError("UNAVAILABLE", "Terminal connection ended before creation.");
    const opening = openTerminal(lease.connection, {
      cwd, argv: [runtime.python, "-u", "-c", wrapperSource, entry.generation, ...(entry.startup?.shellCommand ?? HUMAN_BASH_COMMAND)],
      env: { ...runtime.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
      rows: entry.rows, cols: entry.cols,
      onData: (bytes) => { try { receiveOutput(entry, bytes); } catch (error) { entry.rejectHandshake(error); } },
    });
    const deadline = Promise.withResolvers<never>();
    timer = setTimeout(() => deadline.reject(new WireError("UNAVAILABLE", "Terminal creation timed out; cleanup is unconfirmed.")), ctx.options.workspace.terminalStartTimeoutMs);
    timer.unref();
    void opening.then((terminal) => {
      entry.terminal = terminal;
      if (entry.closed) terminal.close();
      entry.exited = terminal.exited;
      void terminal.exited.then(
        () => { if (!entry.closing) retireTerminal(ctx, entry); },
        (error) => { entry.rejectHandshake(error); if (!entry.closing) retireTerminal(ctx, entry, error); },
      );
    }, () => {});
    await Promise.race([Promise.all([opening, entry.handshake]), deadline.promise]);
    if (entry.closed) throw new WireError("UNAVAILABLE", "Terminal ended during creation.");
    if (entry.wrapperPid !== entry.terminal?.pid) throw new Error("PTY wrapper identity does not match the public handle.");
  } catch (error) {
    entry.terminal?.close();
    retireTerminal(ctx, entry, error);
    throw error;
  } finally { clearTimeout(timer); }
}

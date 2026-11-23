import { WireError } from "../../gateway/wire/create-error.ts";
import type { PtyContext } from "./terminal-state.ts";
import { retireTerminal } from "./retire-terminal.ts";

const hangup = "import os,signal,sys\ntry: os.kill(int(sys.argv[1]), signal.SIGHUP)\nexcept ProcessLookupError: pass\n";

export function closeTerminal(ctx: PtyContext, sessionId: string, name: string): Promise<{ closed: true }> {
  const entry = ctx.sessions.get(sessionId)?.get(name);
  if (!entry) return Promise.reject(new WireError("NOT_FOUND", "Terminal is no longer owned; cleanup is not confirmed."));
  return entry.closing ??= (async () => {
    const abort = new AbortController();
    const deadline = Promise.withResolvers<never>();
    const timer = setTimeout(() => {
      abort.abort();
      deadline.reject(new WireError("UNAVAILABLE", "Terminal close timed out; cleanup is not confirmed."));
    }, ctx.options.workspace.terminalCloseTimeoutMs);
    timer.unref();
    try {
      await Promise.race([entry.opening, deadline.promise]);
      if (entry.closed || !entry.lease || !entry.terminal || !entry.shellPid || !entry.runtime) throw new WireError("UNAVAILABLE", "Terminal connection ended before close.");
      const result = await Promise.race([entry.lease.connection.request("exec", {
        cwd: "/",
        argv: [entry.runtime.basePython, "-c", hangup, String(entry.shellPid)],
      }, { session: entry.daemonSession, signal: abort.signal }), deadline.promise]);
      if (result.json.exitCode !== 0) throw new WireError("UNAVAILABLE", "Could not send terminal shell SIGHUP.");
      await Promise.race([entry.exited, deadline.promise]);
      entry.terminal.close();
      retireTerminal(ctx, entry);
      await entry.release;
      return { closed: true };
    } catch (error) {
      entry.terminal?.close();
      retireTerminal(ctx, entry, error);
      throw error;
    } finally { clearTimeout(timer); abort.abort(); }
  })();
}

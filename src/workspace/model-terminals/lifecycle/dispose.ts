import { WireError } from "../../../gateway/wire/create-error.ts";
import { wake } from "../waiting/notify-waiters.ts";
import { finish } from "../commands/finish-command.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { clearTimers } from "../timing/clear-timers.ts";

export function dispose(ctx: ModelTerminalsContext, entry: ModelTerminal): void {
    if (entry.disposed) return;
    entry.disposed = true;
    entry.suppress = true;
    if (entry.current) {
      clearTimers(entry.current);
      if (entry.current.status === "running") finish(ctx, entry, entry.current, null);
      wake(entry.current);
    }
    entry.closed = true;
    entry.rejectReady(new WireError("UNAVAILABLE", "Terminal closed."));
    entry.unsubscribe();
    entry.prompt?.dispose();
    void entry.parsed.then(() => { entry.terminal.dispose(); }, () => { entry.terminal.dispose(); });
  }

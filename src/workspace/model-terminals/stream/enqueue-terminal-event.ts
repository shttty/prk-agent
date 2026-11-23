import { WireError } from "../../../gateway/wire/create-error.ts";
import { publish } from "../notifications/publish.ts";
import type { TerminalEvent } from "../../terminals/terminals-types.ts";
import { wake } from "../waiting/notify-waiters.ts";
import { scheduleQuiet } from "../notifications/schedule-quiet.ts";
import { finish } from "../commands/finish-command.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { writeTerminalOutput } from "./write-terminal-output.ts";

export function enqueue(ctx: ModelTerminalsContext, entry: ModelTerminal, event: TerminalEvent): void {
    entry.parsed = entry.parsed.then(async () => {
      if (entry.closed) return;
      if (event.type === "resize") { entry.terminal.resize(event.cols, event.rows); return; }
      if (event.type === "closed") {
        await writeTerminalOutput(ctx, entry, "", true);
        entry.closed = true;
        const command = entry.current;
        if (command?.status === "running") finish(ctx, entry, command, null, "exit");
        else if (command) publish(ctx, entry, command, "exit");
        entry.rejectReady(new WireError("UNAVAILABLE", "Terminal shell exited."));
        return;
      }
      const command = entry.current;
      if (command?.status === "running") {
        command.lastOutput = Date.now();
        scheduleQuiet(ctx, entry, command);
        wake(command);
      }
      await writeTerminalOutput(ctx, entry, event.data);
    });
  }

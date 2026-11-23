import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { countPtyOutput } from "../output/count-pty-output.ts";
import { interruptCommand } from "../timing/interrupt-command.ts";
import { publish } from "../notifications/publish.ts";
import { preserveScrollback } from "../output/preserve-scrollback.ts";

/** Frame only our shell protocol; xterm remains the parser and command authority. */
export async function writeTerminalOutput(ctx: ModelTerminalsContext, entry: ModelTerminal, data: string, flush = false): Promise<void> {
  const text = entry.pendingOutput + data;
  let end = text.length;
  if (!flush) {
    // Carry an incomplete OSC 133 (including a split ST) across transport frames.
    for (let index = Math.max(0, end - 64); index < end; index++) {
      if (text[index] !== "\x1b") continue;
      const suffix = text.slice(index);
      if ("\x1b]133;".startsWith(suffix) || /^\x1b\]133;[ABCD](?:;-?\d*)?\x1b?$/u.test(suffix)) {
        end = index;
        break;
      }
    }
  }
  entry.pendingOutput = text.slice(end);
  const framed = text.slice(0, end);
  const markers = /\x1b\]133;[ABCD](?:;-?\d+)?(?:\x07|\x1b\\)/gu;
  const write = async (part: string, control = false) => {
    for (let offset = 0; offset < part.length;) {
      // Soft wraps do not emit onLineFeed. Bound each write below a viewport,
      // including double-width characters, then drain its committed rows.
      const capacity = Math.max(2, Math.floor(entry.terminal.cols * Math.max(1, entry.terminal.rows - 2) / 2));
      let next = Math.min(offset + Math.min(4096, capacity), part.length);
      const last = part.charCodeAt(next - 1);
      if (next < part.length && last >= 0xd800 && last <= 0xdbff) next--;
      const chunk = part.slice(offset, next);
      const exceeded = control ? undefined : countPtyOutput(ctx, entry, chunk);
      const parsed = Promise.withResolvers<void>();
      entry.terminal.write(chunk, parsed.resolve);
      await parsed.promise;
      preserveScrollback(ctx, entry, true);
      if (exceeded?.model && !entry.replaying) {
        if (entry.outputBrake) interruptCommand(ctx, entry, exceeded);
        else publish(ctx, entry, exceeded, "warning");
      }
      offset = next;
    }
  };
  let offset = 0;
  for (const marker of framed.matchAll(markers)) {
    await write(framed.slice(offset, marker.index));
    await write(marker[0], true);
    offset = marker.index + marker[0].length;
  }
  await write(framed.slice(offset));
}

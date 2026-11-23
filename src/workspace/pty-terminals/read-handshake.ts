import type { PtyEntry } from "./terminal-state.ts";

/** Consumes only the wrapper's first record, not an input acknowledgement. */
export function readHandshake(entry: PtyEntry, data: string): string {
  if (entry.shellPid !== undefined) return data;
  const prefix = `\x1b]777;prk;${entry.generation};`;
  const text = entry.startupText + data;
  const end = text.indexOf("\x07");
  const maximum = prefix.length + 2 * String(Number.MAX_SAFE_INTEGER).length + 2 + "normal-close-only".length;
  if ((end < 0 ? text.length : end) > maximum || !prefix.startsWith(text.slice(0, Math.min(text.length, prefix.length)))) throw new Error("Invalid PTY shell startup record.");
  if (end < 0) { entry.startupText = text; return ""; }
  const [wrapper, shell, cleanup, extra] = text.slice(prefix.length, end).split(";");
  const pids = [Number(wrapper), Number(shell)];
  if (extra !== undefined || !pids.every((pid) => Number.isSafeInteger(pid) && pid > 0) || (cleanup !== "linux-pdeathsig" && cleanup !== "normal-close-only")) throw new Error("Invalid PTY shell identity.");
  [entry.wrapperPid, entry.shellPid] = pids;
  entry.cleanup = cleanup;
  entry.startupText = "";
  entry.resolveHandshake();
  return text.slice(end + 1);
}

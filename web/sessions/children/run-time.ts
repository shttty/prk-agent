import { formatWorkTime } from "../../chat/transcript/turns/format-work-time.js";

type RunTimes = { startedAt?: number; finishedAt?: number; delivered: boolean };

/** How long a child session has run, from the optional workbench row fields `startedAt` / `finishedAt` (epoch ms;
 * frontend ready, backend pending — docs/wire/sessions.md). Delivered: total time, only when `finishedAt` is there too.
 * Otherwise the time since start. "" when the fields are absent: nothing is shown, no placeholder. */
export function runTime({ startedAt, finishedAt, delivered }: RunTimes, now: number): string {
  if (startedAt === undefined || !Number.isFinite(startedAt)) return "";
  if (delivered) return finishedAt !== undefined && Number.isFinite(finishedAt) && finishedAt >= startedAt ? `用时 ${formatWorkTime(finishedAt - startedAt)}` : "";
  return `已运行 ${formatWorkTime(Math.max(0, now - startedAt))}`;
}

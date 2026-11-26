import { runTime } from "./run-time.ts";

type RunTimeProps = { startedAt?: number; finishedAt?: number; delivered: boolean; now: number };

/** " · 已运行 3m 4s" / " · 用时 12m" after a child session's state, or nothing without `startedAt`. */
export function RunTime({ startedAt, finishedAt, delivered, now }: RunTimeProps) {
  const time = runTime({ startedAt, finishedAt, delivered }, now);
  return time ? <span className="pi-run-time" data-run-time={delivered ? "total" : "running"}> · {time}</span> : null;
}

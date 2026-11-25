import { formatBytes } from "./format-bytes.js";

/** The session's background processes, everything under a kernel or model terminal except the root itself and the
 * runner's own helper, with their totals and the one-line summary "9 个 · 8 个脱管 · CPU 6% · 内存 336 MB" (no 脱管 part
 * when none escaped; "+" after the count when the sample was cut short). `cpuPercent` is null until a sample has a CPU
 * reading. */
export function processSummary(processes, truncated = false) {
  const background = processes.filter(({ depth, ownership }) => depth > 0 && ownership !== "infrastructure");
  const cpu = background.filter(({ cpuPercent }) => cpuPercent !== null);
  const count = background.length;
  const detached = background.filter(({ ownership }) => ownership === "detached").length;
  const cpuPercent = cpu.length ? cpu.reduce((total, { cpuPercent }) => total + cpuPercent, 0) : null;
  const rssBytes = background.reduce((total, { rssBytes }) => total + rssBytes, 0);
  const parts = [`${count}${truncated ? "+" : ""} 个`, detached ? `${detached} 个脱管` : null,
    `CPU ${cpuPercent === null ? "—" : `${cpuPercent.toFixed(0)}%`}`, `内存 ${formatBytes(rssBytes)}`];
  return { count, detached, cpuPercent, rssBytes, text: parts.filter(Boolean).join(" · ") };
}

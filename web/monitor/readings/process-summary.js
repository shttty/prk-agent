/** The session's background processes, everything under a kernel or model terminal except the root itself and the
 * runner's own helper, with their totals and the one-line summary "9 · 8 脱管 · CPU 6%" (no 脱管 part when none escaped;
 * "+" after the count when the sample was cut short). `cpuPercent` is null until a sample has a CPU reading; it is the
 * summed share of one core, so it can exceed 100. */
export function processSummary(processes, truncated = false) {
  const background = processes.filter(({ depth, ownership }) => depth > 0 && ownership !== "infrastructure");
  const cpu = background.filter(({ cpuPercent }) => cpuPercent !== null);
  const count = background.length;
  const detached = background.filter(({ ownership }) => ownership === "detached").length;
  const cpuPercent = cpu.length ? cpu.reduce((total, { cpuPercent }) => total + cpuPercent, 0) : null;
  const parts = [`${count}${truncated ? "+" : ""}`, detached ? `${detached} 脱管` : null,
    `CPU ${cpuPercent === null ? "—" : `${Math.round(cpuPercent)}%`}`];
  return { count, detached, cpuPercent, text: parts.filter(Boolean).join(" · ") };
}

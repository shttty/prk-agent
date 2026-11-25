/** The session's background processes, everything under a kernel or model terminal except the root itself and the
 * runner's own helper, with their totals. `cpuPercent` is null until a sample has a CPU reading. */
export function processSummary(processes) {
  const background = processes.filter(({ depth, ownership }) => depth > 0 && ownership !== "infrastructure");
  const cpu = background.filter(({ cpuPercent }) => cpuPercent !== null);
  return {
    count: background.length,
    detached: background.filter(({ ownership }) => ownership === "detached").length,
    cpuPercent: cpu.length ? cpu.reduce((total, { cpuPercent }) => total + cpuPercent, 0) : null,
    rssBytes: background.reduce((total, { rssBytes }) => total + rssBytes, 0),
  };
}

import type { MonitoredProcess, ProcessRoot, RawProcess } from "../../telemetry/process-types.ts";

export function classifyProcesses(rows: readonly RawProcess[], roots: readonly ProcessRoot[]): MonitoredProcess[] {
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const children = Map.groupBy(rows, ({ parentPid }) => parentPid);
  const seen = new Set<number>();
  const result: MonitoredProcess[] = [];
  for (const root of roots) {
    const top = byPid.get(root.pid);
    if (top) visit(top, root, top.foregroundGroup, 0);
  }
  return result;

  function visit(process: RawProcess, root: ProcessRoot, foreground: number, depth: number) {
    if (seen.has(process.pid)) return;
    seen.add(process.pid);
    const { pid, cpuPercent, rssBytes, command } = process;
    const ownership = depth === 0 ? "root" : pid === root.infrastructurePid ? "infrastructure"
      : !root.running ? "detached"
      : root.kind === "kernel" ? "unknown"
      : foreground > 0 && foreground !== root.pid && process.group === foreground ? "managed" : "detached";
    result.push({ pid, cpuPercent, rssBytes, command, depth, kind: root.kind, ownership });
    for (const child of children.get(pid) ?? []) visit(child, root, foreground, depth + 1);
  }
}

import { formatBytes } from "../readings/format-bytes.js";
import { kernelMemory } from "../readings/kernel-memory.js";
import { machineMemory } from "../readings/machine-memory.js";
import { percent } from "../readings/percent.js";
import { IN_FLIGHT } from "../../sessions/children/in-flight.js";
import { Count } from "./Count.jsx";
import { KERNEL_LABELS } from "./monitor-panel-constants.js";

const pct = (value) => Number.isFinite(value) ? `${percent(value)}%` : "—";

export function MonitorOverview({ monitor, kernel, children, processes }) {
  const machine = monitor?.machine;
  const mem = machineMemory(machine);
  const disk = machine?.disk;
  const memory = kernelMemory(kernel);
  const states = children.map(({ state }) => state.key);
  const count = (key) => states.filter((state) => state === key).length;
  const running = states.filter((key) => IN_FLIGHT.has(key) || key === "compacting").length;
  const processCount = processes.filter(({ depth, ownership }) => depth > 0 && ownership !== "infrastructure").length;
  const changes = monitor?.changes;
  return <div className="pi-monitor-overview" id="monitor-overview" data-process-count={processCount}>
    <div><span>CPU <b>{pct(machine?.cpu?.pct)}</b></span><span>内存 <b>{pct(mem?.percent)}</b></span><span>负载 <b>{machine?.load?.[0]?.toFixed(2) ?? "—"}</b></span><span>磁盘 <b>{pct(disk && 100 * (disk.total - disk.free) / disk.total)}</b></span>
      {machine?.gpus?.length ? machine.gpus.map(({ util, name }, index) => <span key={index} title={name}>GPU{machine.gpus.length > 1 ? index : ""} <b>{pct(util)}</b></span>) : <span>GPU <b>—</b></span>}
    </div>
    <div><span>Kernel <b>{KERNEL_LABELS[kernel?.state] ?? "—"}</b>{memory ? ` · ${formatBytes(memory.used)}${memory.limit ? ` / ${formatBytes(memory.limit)}` : ""}` : ""}</span><span>后台进程 <b>{processCount}{monitor?.processesTruncated ? "+" : ""}</b></span><span className="pi-monitor-summary">改动 {changes ? <Count added={changes.added} removed={changes.removed} /> : "—"}</span></div>
    <div><span>子会话 <b>{children.length}</b></span>{children.length ? <span>{running} 运行中 · {count("background")} 后台 · {count("blocked")} 待处理 · {count("delivered")} 已交付{count("stopped") ? ` · ${count("stopped")} 出错` : ""}</span> : null}</div>
  </div>;
}

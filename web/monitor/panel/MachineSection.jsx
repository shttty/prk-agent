import { machineMemory } from "../readings/machine-memory.js";
import { sampleAgeSeconds } from "../readings/sample-age-seconds.js";
import { seriesOf } from "../readings/series-of.js";
import { Metric } from "./Metric.jsx";
import { percent } from "../readings/percent.js";
import { formatBytes } from "../readings/format-bytes.js";
import { Text } from "@mantine/core";
export function MachineSection({ monitor, now, history, windowMs }) {
  const machine = monitor?.machine;
  const memory = machineMemory(machine);
  const age = sampleAgeSeconds(monitor, machine, now);
  const window = [now - windowMs, now];
  const disk = machine?.disk;
  const gpus = machine?.gpus ?? [];
  const load = seriesOf(history, (point) => point.load);
  return <section className="pi-monitor-section is-machine" id="monitor-machine" data-status={machine ? "ok" : "none"} data-points={history.length} data-window-ms={windowMs} aria-label="机器">
    {machine ? <div className="pi-monitor-metrics">
      <Metric id="monitor-cpu" title="CPU" value={percent(machine.cpu?.pct)} unit="%" detail={machine.cpu?.cores ? `${machine.cpu.cores} 核` : ""} points={seriesOf(history, (point) => point.cpu)} window={window} max={100} />
      <Metric id="monitor-memory" title="内存" value={memory ? percent(memory.percent) : null} unit="%" detail={memory ? `${formatBytes(memory.used)} / ${formatBytes(memory.total)}` : ""} points={seriesOf(history, (point) => point.mem)} window={window} max={100} />
      <Metric id="monitor-load" title="负载" value={machine.load ? machine.load[0].toFixed(2) : null} detail={machine.load ? machine.load.slice(1).map((value) => value.toFixed(2)).join(" · ") : ""} points={load} window={window} max={machine.cpu?.cores ? Math.max(machine.cpu.cores / 2, ...(load ?? []).map(([, value]) => value)) : undefined} />
      <Metric id="monitor-disk" title="磁盘" value={disk ? percent(((disk.total - disk.free) / disk.total) * 100) : null} unit="%" detail={disk ? `${formatBytes(disk.total - disk.free)} / ${formatBytes(disk.total)}` : ""} points={seriesOf(history, (point) => point.disk)} window={window} max={100} />
      {gpus.map((gpu, index) => <Metric key={index} id={`monitor-gpu-${index}`} wide={gpus.length % 2 === 1 && index === gpus.length - 1} title={gpus.length > 1 ? `GPU ${index}` : "GPU"} value={percent(gpu.util)} unit="%" detail={`${gpu.name ? `${gpu.name.replace(/^NVIDIA\s+(GeForce\s+)?/u, "")} · ` : ""}${formatBytes(gpu.memUsed)} / ${formatBytes(gpu.memTotal)}`} points={seriesOf(history, (point) => point.gpus[index])} window={window} max={100} />)}
    </div> : <Text size="xs" c="dimmed">暂无数据。</Text>}
    <div className="pi-monitor-window">
      <span>{windowMs < 60000 ? `${windowMs / 1000} 秒` : `${Number((windowMs / 60000).toFixed(1))} 分钟`}</span>
      {age !== null ? <span className="pi-monitor-age" id="monitor-machine-age" data-seconds={age}>{age} 秒前采集</span> : null}
    </div>
  </section>;
}

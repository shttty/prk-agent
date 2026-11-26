import { Group, SimpleGrid, Text } from "@mantine/core";
import { machineMemory } from "../readings/machine-memory.ts";
import type { MachinePoint, StampedMonitor } from "../readings/monitor-types.ts";
import { sampleAgeSeconds } from "../readings/sample-age-seconds.ts";
import { seriesOf } from "../readings/series-of.ts";
import { percent } from "../readings/percent.ts";
import { formatBytes } from "../readings/format-bytes.ts";
import { Metric } from "./Metric.tsx";

type MachineSectionProps = { monitor: StampedMonitor | undefined; now: number; history: readonly MachinePoint[]; windowMs: number };

export function MachineSection({ monitor, now, history, windowMs }: MachineSectionProps) {
  const machine = monitor?.machine;
  const memory = machineMemory(machine);
  const age = sampleAgeSeconds(monitor, machine, now);
  const window: [number, number] = [now - windowMs, now];
  const disk = machine?.disk;
  const load = seriesOf(history, (point) => point.load);
  return <section className="pi-monitor-section is-machine" id="monitor-machine" data-status={machine ? "ok" : "none"} data-points={history.length} data-window-ms={windowMs} aria-label="机器">
    {machine ? <SimpleGrid cols={2} spacing={8} px={12} pt={6}>
      <Metric id="monitor-cpu" title="CPU" value={percent(machine.cpu.pct)} unit="%" detail={machine.cpu.cores ? `${machine.cpu.cores} 核` : ""} points={seriesOf(history, (point) => point.cpu)} window={window} max={100} />
      <Metric id="monitor-memory" title="内存" value={memory ? percent(memory.percent) : null} unit="%" detail={memory ? `${formatBytes(memory.used)} / ${formatBytes(memory.total)}` : ""} points={seriesOf(history, (point) => point.mem)} window={window} max={100} />
      <Metric id="monitor-load" title="负载" value={machine.load ? machine.load[0]?.toFixed(2) ?? null : null} detail={machine.load ? machine.load.slice(1).map((value) => value.toFixed(2)).join(" · ") : ""} points={load} window={window} max={machine.cpu.cores ? Math.max(machine.cpu.cores / 2, ...(load ?? []).map(([, value]) => value)) : undefined} />
      <Metric id="monitor-disk" title="磁盘" value={disk ? percent(((disk.total - disk.free) / disk.total) * 100) : null} unit="%" detail={disk ? `${formatBytes(disk.total - disk.free)} / ${formatBytes(disk.total)}` : ""} points={seriesOf(history, (point) => point.disk)} window={window} max={100} />
      {machine.gpus.map((gpu, index) => <Metric key={index} id={`monitor-gpu-${index}`} wide={machine.gpus.length % 2 === 1 && index === machine.gpus.length - 1} title={machine.gpus.length > 1 ? `GPU ${index}` : "GPU"} value={percent(gpu.util)} unit="%" detail={`${gpu.name ? `${gpu.name.replace(/^NVIDIA\s+(GeForce\s+)?/u, "")} · ` : ""}${formatBytes(gpu.memUsed)} / ${formatBytes(gpu.memTotal)}`} points={seriesOf(history, (point) => point.gpus[index])} window={window} max={100} />)}
    </SimpleGrid> : <Text size="xs" c="dimmed">暂无数据。</Text>}
    <Group justify="space-between" gap={8} px={14} pt={6} pb={10} className="pi-monitor-window">
      <span>{windowMs < 60000 ? `${windowMs / 1000} 秒` : `${Number((windowMs / 60000).toFixed(1))} 分钟`}</span>
      {age !== null ? <span className="pi-monitor-age" id="monitor-machine-age" data-seconds={age}>{age} 秒前采集</span> : null}
    </Group>
  </section>;
}

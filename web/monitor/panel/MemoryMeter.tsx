import { Progress } from "@mantine/core";

type MemoryMeterProps = { percent: number; alert?: boolean; stale?: boolean };

/** A working set against its limit, as a thin bar: red when memory is near the limit, faint when it is the last reading of a kernel that went away. */
export function MemoryMeter({ percent, alert = false, stale = false }: MemoryMeterProps) {
  return <Progress value={Math.min(100, percent)} size={4} radius={2} mt={5} bg="var(--pi-track)" color={alert ? "var(--pi-danger)" : stale ? "var(--pi-faint)" : "var(--pi-accent)"} data-alert={alert ? "true" : undefined} data-stale={stale ? "true" : undefined} aria-label="内存占用" />;
}

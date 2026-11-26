import { SimpleGrid } from "@mantine/core";
import type { MonitorHistory } from "../../../src/gateway/wire/web-types.ts";
import type { ChartPoints } from "../readings/monitor-types.ts";
import { Metric } from "./Metric.tsx";
import { SectionTitle } from "./SectionTitle.tsx";

type CustomSectionProps = { history: MonitorHistory | null; now: number };

export function CustomSection({ history, now }: CustomSectionProps) {
  if (!history?.customMetrics.length) return null;
  const window: [number, number] = [now - history.windowMs, now];
  return <section className="pi-monitor-section" id="monitor-custom" aria-label="自定义">
    <SectionTitle>自定义</SectionTitle>
    <SimpleGrid cols={2} spacing={8} px={12} pt={6}>
      {history.customMetrics.map((metric) => {
        const result = metric.samples.at(-1)?.value;
        const points: ChartPoints = [];
        for (const { at, value } of metric.samples) if (at >= window[0] && typeof value.value === "number" && Number.isFinite(value.value)) points.push([at, value.value]);
        return <Metric key={metric.name} name={metric.name} title={metric.name} value={result?.value ?? null} unit={metric.unit} error={result?.error} points={points.length > 1 ? points : null} window={window} />;
      })}
    </SimpleGrid>
  </section>;
}

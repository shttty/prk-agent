import { Flex, Group, Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import type { ChartPoints } from "../readings/monitor-types.ts";
import LineChart from "./LineChart.tsx";

type MetricProps = {
  id?: string;
  title: string;
  value: number | string | null;
  unit?: string;
  detail?: string;
  points: ChartPoints | null;
  window: [number, number];
  max?: number;
  wide?: boolean;
  /** A custom metric's name: it marks the tile and reports its own status. */
  name?: string;
  error?: string | null;
};

export function Metric({ id, title, value, unit, detail, points, window, max, wide, name, error }: MetricProps) {
  return <Flex direction="column" className={`pi-monitor-metric${wide ? " is-wide" : ""}`} id={id} data-metric={name} data-status={name ? error ? "error" : value === null ? "pending" : "ok" : undefined} data-points={points?.length ?? 0} data-first-at={points?.[0]?.[0]}>
    <Group justify="space-between" align="baseline" gap={6} wrap="nowrap">
      <span className="pi-monitor-metric-title">{title}</span>
      <Text component="span" truncate="end" className="pi-monitor-metric-detail">{detail}</Text>
    </Group>
    <div className="pi-monitor-metric-value">{value ?? "—"}{value !== null && unit ? <small>{unit}</small> : null}</div>
    {points ? <LineChart points={points} from={window[0]} to={window[1]} max={max} /> : null}
    {error ? <InlineAlert className="pi-monitor-error">{error}</InlineAlert> : null}
  </Flex>;
}

import type { MonitorHistory, SessionMonitor } from "../../../src/gateway/wire/web-types.ts";

/** A session's monitor as the browser holds it: the Gateway's reading plus when it arrived. */
export type StampedMonitor = SessionMonitor & { receivedAt: number };

/** Fields of a session row the monitor readings look at. */
export type MonitoredRow = { monitor?: StampedMonitor };

export type MachineSampleAt = MonitorHistory["machine"][number];

/** One machine reading as the charts plot it; a missing figure is null. */
export type MachinePoint = { t: number; cpu: number | null; mem: number | null; load: number | null; disk: number | null; gpus: (number | null)[] };

/** `[time, value]` pairs of one chart line. */
export type ChartPoints = [number, number][];

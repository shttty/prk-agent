import { useEffect, useEffectEvent, useState } from "react";
import type { MetricView, MonitorHistory } from "../../../src/gateway/wire/web-types.ts";
import type { WorkbenchActions } from "../../sessions/workbench-actions-types.ts";
import type { StampedMonitor } from "../readings/monitor-types.ts";

type Stamped<Value> = { at: number; value: Value };

function appendSample<Value>(samples: readonly Stamped<Value>[], sample: Stamped<Value> | null | undefined, windowMs: number): readonly Stamped<Value>[] {
  const last = samples.at(-1);
  if (!sample || (last && last.at >= sample.at)) return samples;
  return [...samples.filter(({ at }) => at >= sample.at - windowMs), sample];
}

/** The history that seeds the charts (`GET .../monitor/history`) kept current from the session's live monitor, and the focus lease that asks the Gateway for fast sampling while the panel is open. */
export default function useMonitorHistory(actions: WorkbenchActions, sessionId: string, monitor: StampedMonitor | undefined) {
  const [history, setHistory] = useState<MonitorHistory | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const ingest = useEffectEvent((seed?: MonitorHistory) => setHistory((previous) => {
    const base = seed ?? previous;
    if (!base) return base;
    const machine = monitor?.machine;
    const sample = machine ? { at: machine.sampledAt, value: machine } : null;
    const definitions = seed ? base.customMetrics : monitor?.customMetrics ?? base.customMetrics;
    return { ...base, machine: appendSample(base.machine, sample, base.windowMs), customMetrics: definitions.map((metric) => {
      const old = base.customMetrics.find(({ name }) => name === metric.name);
      const live: MetricView | undefined = monitor?.customMetrics.find(({ name }) => name === metric.name);
      return { name: metric.name, unit: metric.unit, chart: metric.chart, samples: appendSample(old?.samples ?? [], live?.sample, base.windowMs) };
    }) };
  }));
  const sampledAt = monitor?.machine?.sampledAt;
  const metrics = monitor?.customMetrics;
  useEffect(() => { ingest(); }, [sampledAt, metrics]);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const path = `/sessions/${encodeURIComponent(sessionId)}/monitor`;
    const beat = async () => {
      let next = 10000;
      try {
        const reply = await actions.api.post(`${path}/focus`, { open: true });
        next = Math.max(1, Math.floor(reply.leaseMs / 3));
      } catch { /* the next heartbeat retries */ }
      if (live) timer = setTimeout(() => void beat(), next);
    };
    setError("");
    actions.api.get(`${path}/history`).then((reply: MonitorHistory) => {
      if (!live) return;
      ingest(reply);
      void beat();
    }).catch((failure: unknown) => { if (live) setError(failure instanceof Error ? failure.message : "历史读取失败。"); });
    return () => {
      live = false;
      clearTimeout(timer);
      void actions.api.post(`${path}/focus`, { open: false }).catch(() => {});
    };
  }, [actions, sessionId, attempt]);
  return { history, error, retry: () => setAttempt((value) => value + 1) };
}

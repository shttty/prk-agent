import { useState } from "react";
import { useEffectEvent } from "react";
import { useEffect } from "react";
export function appendSample(samples, sample, windowMs) {
  if (!sample || samples.at(-1)?.at >= sample.at) return samples;
  return [...samples.filter(({ at }) => at >= sample.at - windowMs), sample];
}

export default function useMonitorHistory(actions, name, monitor) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const ingest = useEffectEvent((seed) => setHistory((previous) => {
    const base = seed ?? previous;
    if (!base) return base;
    const machine = monitor?.machine;
    const sample = machine ? { at: machine.sampledAt, value: machine } : null;
    const definitions = seed ? base.customMetrics : monitor?.customMetrics ?? base.customMetrics;
    return { ...base, machine: appendSample(base.machine, sample, base.windowMs), customMetrics: definitions.map((metric) => {
      const old = base.customMetrics.find(({ name }) => name === metric.name);
      const live = monitor?.customMetrics?.find(({ name }) => name === metric.name);
      return { name: metric.name, unit: metric.unit, chart: metric.chart, samples: appendSample(old?.samples ?? [], live?.sample, base.windowMs) };
    }) };
  }));
  const sampledAt = monitor?.machine?.sampledAt;
  const metrics = monitor?.customMetrics;
  useEffect(() => { ingest(); }, [sampledAt, metrics]);
  useEffect(() => {
    if (!name) return undefined;
    let live = true;
    let timer;
    const path = `/sessions/${encodeURIComponent(name)}/monitor`;
    const beat = async () => {
      let next = 10000;
      try {
        const reply = await actions.api.post(`${path}/focus`, { open: true });
        next = Math.max(1, Math.floor(reply.leaseMs / 3));
      } catch { /* the next heartbeat retries */ }
      if (live) timer = setTimeout(beat, next);
    };
    setError("");
    actions.api.get(`${path}/history`).then((reply) => {
      if (!live) return;
      ingest(reply);
      void beat();
    }).catch((failure) => { if (live) setError(failure instanceof Error ? failure.message : "历史读取失败。"); });
    return () => {
      live = false;
      clearTimeout(timer);
      void actions.api.post(`${path}/focus`, { open: false }).catch(() => {});
    };
  }, [actions, name, attempt]);
  return { history, error, retry: () => setAttempt((value) => value + 1) };
}

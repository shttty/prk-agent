import "./session-usage.css";
import React from "react";
import { usageRows } from "./usage-rows.ts";
import type { ContextUsageFacts, SessionStats } from "./session-usage-types.ts";

type UsageFactsProps = { stats?: SessionStats | null; contextUsage?: ContextUsageFacts | null; loading?: boolean; failed?: boolean; className?: string; id?: string };

export function UsageFacts({ stats, contextUsage, loading = false, failed = false, className = "pi-usage-facts", id }: UsageFactsProps) {
  return (
    <dl className={className} id={id} aria-busy={loading || undefined}>
      {usageRows(stats, contextUsage).map(([metric, term, value]) => (
        <React.Fragment key={metric}><dt data-metric={metric}>{term}</dt><dd data-metric-value={metric} data-count={metric === "messages" ? stats?.totalMessages ?? stats?.messageCount : undefined}>{value}</dd></React.Fragment>
      ))}
      {loading && !stats ? <><dt data-metric="statistics">统计</dt><dd>正在读取…</dd></> : null}
      {failed && !loading && !stats ? <><dt data-metric="statistics">统计</dt><dd>读取失败，请稍后重试。</dd></> : null}
    </dl>
  );
}

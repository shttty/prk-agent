import StatusDot from "../../design-system/status-dot/StatusDot.jsx";
import { formatBytes } from "../readings/format-bytes.js";
import { processSummary } from "../readings/process-summary.js";
import { FoldSection } from "./FoldSection.jsx";

const OWNER_LABELS = { detached: "脱管", unknown: "归属未定" };

/** Processes under the session's kernel and model terminals, as a tree. Folded, the heading keeps their count, how many
 * escaped their terminal (脱管), and their summed CPU and memory; with none running it reads "无". */
export function ProcessesSection({ processes, truncated }) {
  if (!processes) return null;
  const { count, detached, cpuPercent, rssBytes } = processSummary(processes);
  if (!count) return <section className="pi-monitor-section" id="monitor-processes" data-count={0} aria-label="后台进程"><h3>后台进程 <span className="pi-monitor-summary">无</span></h3></section>;
  const summary = <>
    <span className="pi-monitor-summary-part">{count}{truncated ? "+" : ""} 个</span>
    {detached ? <span className="pi-monitor-summary-part" data-process-owner="detached"><StatusDot tone="error" size={6} />{detached} 脱管</span> : null}
    <span className="pi-monitor-summary-part">CPU {cpuPercent === null ? "—" : `${cpuPercent.toFixed(0)}%`}</span>
    <span className="pi-monitor-summary-part">内存 {formatBytes(rssBytes)}</span>
  </>;
  return <FoldSection name="processes" title="后台进程" summary={summary} id="monitor-processes" data-count={count} data-detached={detached} aria-label="后台进程">
    <div className="pi-monitor-process-grid pi-monitor-process-head"><span>PID</span><span>命令</span><span>CPU</span><span>内存</span></div>
    <ul className="pi-monitor-processes">
      {processes.map(({ pid, command, cpuPercent, rssBytes, depth, kind, ownership }) => <li className="pi-monitor-process-grid" key={pid} data-pid={pid} data-process-owner={ownership} data-depth={depth}>
        <span>{pid}</span>
        <span className="pi-monitor-process-label" style={{ paddingInlineStart: `${Math.min(5, depth) * 8}px` }}>
          <span className="pi-monitor-path" title={command}>{command}</span>
          {ownership === "root" ? <small>{kind === "kernel" ? "Kernel" : "模型终端"}</small> : OWNER_LABELS[ownership] ? <small>{OWNER_LABELS[ownership]}</small> : null}
        </span>
        <span>{cpuPercent === null ? "—" : `${cpuPercent.toFixed(0)}%`}</span>
        <span>{formatBytes(rssBytes)}</span>
      </li>)}
    </ul>
    {truncated ? <span className="pi-monitor-age">仅显示部分进程。</span> : null}
  </FoldSection>;
}

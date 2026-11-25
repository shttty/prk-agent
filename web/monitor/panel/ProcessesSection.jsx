import { formatBytes } from "../readings/format-bytes.js";

export function ProcessesSection({ processes, truncated }) {
  if (!processes.length) return <div className="pi-monitor-section pi-monitor-empty">暂无进程样本。</div>;
  return <div className="pi-monitor-section" id="monitor-processes">
    <div className="pi-monitor-process-grid pi-monitor-process-head"><span>PID</span><span>命令</span><span>CPU</span><span>内存</span></div>
    <ul className="pi-monitor-processes">
      {processes.map(({ pid, command, cpuPercent, rssBytes, depth, kind, ownership }) => <li className="pi-monitor-process-grid" key={pid} data-pid={pid} data-process-owner={ownership} data-depth={depth}>
        <span>{pid}</span>
        <span className="pi-monitor-process-label" style={{ paddingInlineStart: `${Math.min(5, depth) * 8}px` }}>
          <span className="pi-monitor-path" title={command}>{command}</span>
          {ownership === "root" ? <small>{kind === "kernel" ? "Kernel" : "模型终端"}</small> : null}
          {ownership === "detached" ? <small>脱管</small> : null}
          {ownership === "unknown" ? <small>归属未定</small> : null}
        </span>
        <span>{cpuPercent === null ? "—" : `${cpuPercent.toFixed(0)}%`}</span>
        <span>{formatBytes(rssBytes)}</span>
      </li>)}
    </ul>
    {truncated ? <span className="pi-monitor-age">仅显示部分进程。</span> : null}
  </div>;
}

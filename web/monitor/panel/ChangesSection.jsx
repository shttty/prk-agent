import { sampleAgeSeconds } from "../readings/sample-age-seconds.js";
import { Text } from "@mantine/core";
import { Count } from "./Count.jsx";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { STATUS_LETTERS } from "./monitor-panel-constants.js";
export function ChangesSection({ monitor, now, onOpen }) {
  const changes = monitor?.changes;
  const age = sampleAgeSeconds(monitor, changes, now);
  if (!changes) {
    return <section className="pi-monitor-section" id="monitor-changes" data-status="none" aria-label="变更"><Text size="xs" c="dimmed">暂无数据。</Text></section>;
  }
  const git = changes.source === "git";
  // Why the agent source applies: git says "no repository here" (none) or could not decide at all (unavailable).
  const gitState = git ? "repo" : changes.gitUnavailable ? "unavailable" : "none";
  return <section className="pi-monitor-section" id="monitor-changes" data-status="ok" data-source={changes.source} data-git={gitState} data-count={changes.files.length} aria-label={git ? "变更" : "改动量"}>
    <div className="pi-monitor-facts">
      <span id="monitor-files-count"><span data-count={changes.files.length}>{changes.files.length} 个文件</span>{changes.truncated ? "（仅列出一部分）" : ""}</span>
      <span className="pi-monitor-basis" data-basis={git ? "git" : "volume"} data-git={gitState} data-reason={changes.gitReason} title={gitState === "unavailable" ? changes.gitReason : undefined}>{git ? "git 未提交改动" : gitState === "unavailable" ? "git 不可用" : "非 git 仓库"}</span>
    </div>
    {changes.error ? <InlineAlert className="pi-monitor-error">{changes.error}</InlineAlert> : null}
    {changes.files.length ? <ul className="pi-monitor-files">
      {changes.files.map((file) => <li key={file.path}>
        <button type="button" data-action="open-diff" data-path={file.path} data-status={file.status} title={file.path} onClick={() => onOpen(file.path)}>
          <span className="pi-monitor-status">{STATUS_LETTERS[file.status] ?? file.status}</span>
          <span className="pi-monitor-path">{file.path}</span>
          <span className="pi-monitor-counts">{file.binary ? "二进制" : <Count added={file.added} removed={file.removed} />}</span>
        </button>
      </li>)}
    </ul> : null}
    {age !== null ? <span className="pi-monitor-age" id="monitor-changes-age" data-seconds={age}>{age} 秒前采集</span> : null}
  </section>;
}

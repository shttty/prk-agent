import { Text } from "@mantine/core";
import NoteAccordion from "../../../../design-system/note-accordion/NoteAccordion.jsx";
import { StaticMarkdown } from "../../../markdown/StaticMarkdown.jsx";
import { FoldedContent } from "../FoldedContent.jsx";
import { PeerArtifacts } from "./PeerArtifacts.jsx";
const time = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
/** A child's delivered result: summary preview by default; artifacts, patch stats and ids once expanded. */
export function PeerResultReport({ report, messageId }) {
  const more = <div className="pi-peer-report-more">
    {report.artifacts.length ? <PeerArtifacts artifacts={report.artifacts} messageId={messageId} /> : null}
    {report.patchStats ? <NoteAccordion className="pi-peer-patch" title="补丁统计"><pre className="pi-peer-patch-stats">{report.patchStats}</pre></NoteAccordion> : null}
    <Text className="pi-peer-meta" size="xs">{meta(report)}</Text>
  </div>;
  return <div className="pi-peer-report" data-peer-report="result">
    <FoldedContent compact more={more} revision={report.summary}><StaticMarkdown text={report.summary} /></FoldedContent>
  </div>;
}

function meta({ taskId, resultId, startedAt, finishedAt }) {
  const parts = [`task ${taskId.slice(0, 8)}`, `result ${resultId.slice(0, 8)}`];
  if (finishedAt !== null) parts.push(`完成于 ${time.format(finishedAt)}`);
  if (finishedAt !== null && startedAt !== null && finishedAt >= startedAt) parts.push(`用时 ${Math.max(1, Math.round((finishedAt - startedAt) / 60_000))} 分钟`);
  return parts.join(" · ");
}

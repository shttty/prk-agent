import type { PeerBody } from "./project-peer-body.ts";
import { Text } from "@mantine/core";
import NoteAccordion from "../../../../design-system/note-accordion/NoteAccordion.tsx";
import { StaticMarkdown } from "../../../markdown/StaticMarkdown.tsx";
import { FoldedContent } from "../FoldedContent.tsx";
import { PeerArtifacts } from "./PeerArtifacts.tsx";
type ResultReport = Extract<PeerBody, { kind: "result" }>;
const time = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
/** A child's delivered result: summary preview by default; artifacts, patch stats and ids once expanded. */
export function PeerResultReport({ report, messageId }: { report: ResultReport; messageId: string }) {
  const more = <div className="pi-peer-report-more">
    {report.artifacts.length ? <PeerArtifacts artifacts={report.artifacts} messageId={messageId} /> : null}
    {report.patchStats ? <NoteAccordion className="pi-peer-patch" title="补丁统计"><pre className="pi-peer-patch-stats">{report.patchStats}</pre></NoteAccordion> : null}
    <Text className="pi-peer-meta" size="xs">{meta(report)}</Text>
  </div>;
  return <div className="pi-peer-report" data-peer-report="result">
    <FoldedContent compact more={more} revision={report.summary}><StaticMarkdown text={report.summary} /></FoldedContent>
  </div>;
}

function meta({ taskId, resultId, startedAt, finishedAt }: ResultReport) {
  const parts = [`task ${taskId.slice(0, 8)}`, `result ${resultId.slice(0, 8)}`];
  if (finishedAt !== null) parts.push(`完成于 ${time.format(finishedAt)}`);
  if (finishedAt !== null && startedAt !== null && finishedAt >= startedAt) parts.push(`用时 ${Math.max(1, Math.round((finishedAt - startedAt) / 60_000))} 分钟`);
  return parts.join(" · ");
}

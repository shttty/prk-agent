import { Code } from "@mantine/core";
import type { PeerBody } from "./project-peer-body.ts";
import NoteAccordion from "../../../../design-system/note-accordion/NoteAccordion.tsx";
import StatusDot from "../../../../design-system/status-dot/StatusDot.tsx";
/** A child's run-failure notice: one summary line; the delivered JSON stays under 详情. */
export function PeerFailureReport({ report }: { report: Extract<PeerBody, { kind: "failure" }> }) {
  return <div className="pi-peer-report" data-peer-report="failure">
    <p className="pi-peer-failure-summary" title={report.summary}><StatusDot tone="error" size={6} /><span>{report.summary}</span></p>
    <NoteAccordion className="pi-peer-detail" title="详情"><Code block className="pi-peer-detail-json">{report.detail}</Code></NoteAccordion>
  </div>;
}

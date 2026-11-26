import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { BUSY_STATES } from "../sidebar/sidebar-constants.ts";
import { Text } from "@mantine/core";
import { Badge } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { SessionTree } from "./SessionTree.tsx";
import StatusDot from "../../design-system/status-dot/StatusDot.tsx";
import { stateTone } from "../sidebar/labels/state-tone.ts";
import { text } from "../sidebar/text.ts";
import { sessionKindLabel } from "./session-kind-label.ts";
import { stateLabel } from "../sidebar/labels/state-label.ts";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { sessionLabelById } from "../sidebar/labels/session-label-by-id.ts";
import type { ArchivePreview, ArchivePreviewSession } from "../../../src/gateway/wire/web-types.ts";
import type { SessionRows } from "../../workbench/store/store-types.ts";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";
/** Archive preview body shared by the session and project confirmations: the affected tree(s), busy warning and retained sessions. `root` omitted = several roots. */
type ArchivePreviewListProps = { sessions: readonly ArchivePreviewSession[]; root?: string; retained: ArchivePreview["retained"] };

export function ArchivePreviewList({ sessions, root, retained }: ArchivePreviewListProps) {
  const knownSessions: SessionRows = useWorkbench((state: WorkbenchState) => state.sessions);
  const running = sessions.filter((node) => BUSY_STATES.has(node.state)).length;
  return <>
    <SessionTree nodes={sessions} root={root} renderNode={(node) => <span className="management-affected-node" data-affected={node.sessionId}>
      <StatusDot tone={stateTone(node.state)} size={7} />
      <strong>{text(node.label) || node.sessionId}</strong>
      {sessionKindLabel(node) && <Badge component="span" variant="outline" color="gray" size="xs" tt="none" radius="sm" className="management-affected-tag" data-lifecycle={node.lifecycle}>{sessionKindLabel(node)}</Badge>}
      {BUSY_STATES.has(node.state) ? <Badge component="span" variant="light" color="yellow" size="sm" tt="none" className="management-affected-warn">将被中断</Badge> : <Badge component="span" variant="transparent" color="gray" size="sm" tt="none" className="management-affected-state">{stateLabel(node.state)}</Badge>}
    </span>} />
    {running > 0 && <InlineAlert color="yellow" size="sm" role="status" data-count={running} icon={<IconAlertTriangle size={15} stroke={1.8} aria-hidden="true" />}>{running} 个会话正在执行，当前操作会被中断。</InlineAlert>}
    {retained.length > 0 && <div className="management-retained">
      <Text className="management-retained-title" size="xs">不会一起归档：</Text>
      <ul>{retained.map((node) => <li key={node.sessionId} data-retained={node.sessionId}><span className="management-affected-node is-retained">
        <strong>{text(node.label) || node.sessionId}</strong>
        <Badge component="span" variant="default" color="gray" size="xs" tt="none" radius="sm" className="management-affected-tag">保留</Badge>
        <Badge component="span" variant="transparent" color="gray" size="sm" tt="none" className="management-affected-state">{node.owner ? `已交接给 ${sessionLabelById(knownSessions, node.owner)}` : "已升级为长期会话"}</Badge>
      </span></li>)}</ul>
    </div>}
  </>;
}

import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { SessionTree } from "./SessionTree.tsx";
import { text } from "../sidebar/text.ts";
import type { ArchivePreviewSession } from "../../../src/gateway/wire/web-types.ts";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
/** A project archive that stopped early (`error`); `unknown`: the request's outcome is not confirmed. */
export type ProjectOutcome = { archived: readonly ArchivePreviewSession[]; unarchived: readonly ArchivePreviewSession[]; error: { code: string; message: string }; unknown: boolean };

type ListedProps = { title: string; kind: string; nodes: readonly ArchivePreviewSession[] };

function Listed({ title, kind, nodes }: ListedProps) {
  if (!nodes.length) return null;
  return <div data-outcome-list={kind} data-count={nodes.length}>
    <Text size="xs" mb={4}>{title}</Text>
    <SessionTree nodes={nodes} renderNode={(node) => <span className="management-affected-node" data-outcome-session={node.sessionId}>
      <strong>{text(node.label) || node.sessionId}</strong>
    </span>} />
  </div>;
}
/** Result of a project archive that stopped early (`error`): what was archived, what was not, and why. `unknown` = the request outcome is not confirmed. */
export function ArchiveProjectOutcome({ outcome }: { outcome: ProjectOutcome }) {
  return <Stack gap="sm" id="archive-project-result" data-status={outcome.unknown ? "unknown" : "failed"} data-error-code={outcome.error.code || undefined} data-archived-count={outcome.archived.length} data-unarchived-count={outcome.unarchived.length}>
    <InlineAlert size="sm">{outcome.error.message}</InlineAlert>
    <Listed title="已归档：" kind="archived" nodes={outcome.archived} />
    <Listed title="未归档：" kind="unarchived" nodes={outcome.unarchived} />
  </Stack>;
}

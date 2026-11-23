import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { SessionTree } from "./SessionTree.jsx";
import { text } from "../sidebar/text.js";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
function Listed({ title, kind, nodes }) {
  if (!nodes.length) return null;
  return <div data-outcome-list={kind} data-count={nodes.length}>
    <Text size="xs" mb={4}>{title}</Text>
    <SessionTree nodes={nodes} renderNode={(node) => <span className="management-affected-node" data-outcome-session={node.sessionId}>
      <strong>{text(node.label) || node.sessionId}</strong>
    </span>} />
  </div>;
}
/** Result of a project archive that stopped early (`error`): what was archived, what was not, and why. `unknown` = the request outcome is not confirmed. */
export function ArchiveProjectOutcome({ outcome }) {
  return <Stack gap="sm" id="archive-project-result" data-status={outcome.unknown ? "unknown" : "failed"} data-error-code={outcome.error.code || undefined} data-archived-count={outcome.archived.length} data-unarchived-count={outcome.unarchived.length}>
    <InlineAlert size="sm">{outcome.error.message}</InlineAlert>
    <Listed title="已归档：" kind="archived" nodes={outcome.archived} />
    <Listed title="未归档：" kind="unarchived" nodes={outcome.unarchived} />
  </Stack>;
}

import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import MemoryDocument from "../../settings/memory/MemoryDocument.jsx";
import MemoryDeleteDialog from "../../settings/memory/MemoryDeleteDialog.jsx";
import { useMemoryListing } from "../../settings/memory/use-memory-listing.js";
import "../../settings/memory/memory.css";

/** One project's memory file, edited through the same listing and change API as the global memory page. */
export function ProjectMemoryDialog({ actions, project }) {
  const memory = useMemoryListing(actions.api);
  const { listing, busy, error } = memory;
  const layer = listing.layers.find((item) => item.scope === "project");
  // A project registers its record when first assigned; until the listing knows it, its file is simply empty.
  const document = layer && (listing.memories.find((item) => item.target === layer.name && item.project === project.id)
    ?? { target: layer.name, project: project.id, entries: [], chars: 0, limit: layer.capacityCharacters, soft: layer.soft, overLimit: false });
  return <>
    <Stack gap="sm" id="project-memory" data-project={project.id} aria-busy={busy}>
      {listing.error ? <InlineAlert size="sm">{listing.error}</InlineAlert> : null}
      {error ? <InlineAlert id="memory-error" size="sm">{error}</InlineAlert> : null}
      {document ? <MemoryDocument document={document} memory={memory} empty="这个项目还没有记忆。" />
        : busy ? null : <Text size="sm" c="dimmed" data-empty="true">记忆配置里没有项目层。</Text>}
    </Stack>
    <MemoryDeleteDialog memory={memory} />
  </>;
}

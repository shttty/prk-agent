import type { useMemoryListing } from "./use-memory-listing.ts";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Modal } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";

/** Confirms removing one entry, or a deleted instance's whole file, from `useMemoryListing`. */
export default function MemoryDeleteDialog({ memory }: { memory: ReturnType<typeof useMemoryListing> }) {
  const { deletion, setDeletion, busy, error, remove } = memory;
  return <Modal id="memory-delete-dialog" opened={Boolean(deletion)} onClose={() => setDeletion(null)} title="确认删除" centered size={380}>
    <Stack gap="md">
      <Text className="memory-entry-content">{deletion?.old_text ?? deletion?.instance}</Text>
      {error ? <InlineAlert size="sm">{error}</InlineAlert> : null}
      <Group justify="flex-end">
        <Button id="memory-cancel-delete" variant="default" disabled={busy} onClick={() => setDeletion(null)}>取消</Button>
        <Button id="memory-confirm-delete" color="red" loading={busy} onClick={remove}>删除</Button>
      </Group>
    </Stack>
  </Modal>;
}

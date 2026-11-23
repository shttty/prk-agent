import { Group } from "@mantine/core";
import { Badge } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
export function AttachmentChips({ attachments, onReplace, onRemove, title }) {
  if (!attachments?.length) return null;
  return <Group className="pi-attachment-list" gap={4} title={title}>{attachments.map((attachment, index) => <Badge key={`${attachment.name}-${index}`} variant="light" color={attachment.type?.startsWith("image/") ? "sea" : "gray"} title={`${attachment.type} · ${attachment.size} B · ${attachment.source || "browser"}`} rightSection={<Group gap={0}><ActionIcon size="xs" variant="subtle" onClick={() => onReplace(index)} aria-label={`替换附件 ${attachment.name}`} title="替换附件">替</ActionIcon><ActionIcon size="xs" variant="subtle" data-action="remove-attachment" onClick={() => onRemove(index)} aria-label={`移除附件 ${attachment.name}`} title="移除附件"><IconX size={11} /></ActionIcon></Group>}>{attachment.name} · {attachment.size} B</Badge>)}</Group>;
}

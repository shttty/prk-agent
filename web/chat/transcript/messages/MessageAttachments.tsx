import { Box, Badge, Group } from "@mantine/core";
import type { Attachment } from "../../conversation/conversation-types.ts";
import { ImageThumbnail } from "../image-viewer/ImageThumbnail.tsx";
import { imageKey } from "../image-viewer/image-key.ts";

/** Images show as thumbnails that open the lightbox; a file badge only stands in for other files or hidden images. */
export function MessageAttachments({ attachments, messageId, showImages }: { attachments: Attachment[] | undefined; messageId: string; showImages: boolean }) {
  if (!Array.isArray(attachments) || !attachments.length) return null;
  return <Group className="pi-message-attachments" gap={4}>{attachments.map((attachment, index) => {
    const label = attachment.name || "附件";
    const image = Boolean(attachment.type?.startsWith("image/")) && typeof attachment.data === "string";
    return <Box key={`${label}-${index}`} className="pi-message-attachment">
      {image && showImages ? <ImageThumbnail imageId={imageKey("attachment", messageId, index)} label={label}>
        <img src={`data:${attachment.type};base64,${attachment.data}`} alt={label} loading="lazy" />
      </ImageThumbnail> : <Badge variant="light" color="gray" data-attachment-badge>{label}{Number(attachment.size) > 0 ? ` · ${attachment.size} B` : ""}</Badge>}
    </Box>;
  })}</Group>;
}

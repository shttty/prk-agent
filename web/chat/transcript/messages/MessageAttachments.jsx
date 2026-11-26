import { Box, Badge, Group } from "@mantine/core";
import { ImageThumbnail } from "../image-viewer/ImageThumbnail.jsx";
import { imageKey } from "../image-viewer/image-key.js";

/** Images show as thumbnails that open the lightbox; a file badge only stands in for other files or hidden images. */
export function MessageAttachments({ attachments, messageId, showImages }) {
  if (!Array.isArray(attachments) || !attachments.length) return null;
  return <Group className="pi-message-attachments" gap={4}>{attachments.map((attachment, index) => {
    const label = attachment.name || "附件";
    const image = attachment.type?.startsWith("image/") && typeof attachment.data === "string";
    return <Box key={`${label}-${index}`} className="pi-message-attachment">
      {image && showImages ? <ImageThumbnail imageId={imageKey("attachment", messageId, index)} label={label}>
        <img src={`data:${attachment.type};base64,${attachment.data}`} alt={label} loading="lazy" />
      </ImageThumbnail> : <Badge variant="light" color="gray" data-attachment-badge>{label}{Number(attachment.size) > 0 ? ` · ${attachment.size} B` : ""}</Badge>}
    </Box>;
  })}</Group>;
}

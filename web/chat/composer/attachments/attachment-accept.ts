import { FALLBACK_MIME_TYPES } from "./attachment-constants.ts";
import { catalogMimeTypes } from "./catalog-mime-types.ts";
import type { AttachmentLimits } from "../composer-types.ts";
/** Value for a file input's `accept`. */
export function attachmentAccept(limits: AttachmentLimits | undefined) {
  const types = catalogMimeTypes(limits);
  return (types.length ? types : FALLBACK_MIME_TYPES).join(",");
}

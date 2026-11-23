import { FALLBACK_MIME_TYPES } from "./attachment-constants.js";
import { catalogMimeTypes } from "./catalog-mime-types.js";
/** Value for a file input's `accept`. */
export function attachmentAccept(limits) {
  const types = catalogMimeTypes({ attachments: limits });
  return (types.length ? types : FALLBACK_MIME_TYPES).join(",");
}

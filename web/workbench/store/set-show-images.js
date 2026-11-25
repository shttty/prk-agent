import { patch } from "./updates/patch.js";

export function setShowImages(ctx, enabled) {
  patch(ctx, { showImages: enabled });
}

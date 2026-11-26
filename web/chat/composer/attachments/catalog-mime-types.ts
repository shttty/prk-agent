import type { AttachmentLimits } from "../composer-types.ts";

export function catalogMimeTypes(limits: AttachmentLimits | undefined): string[] {
  const values = [...(limits?.imageMimeTypes ?? []), ...(limits?.textMimeTypes ?? [])];
  return [...new Set(values.filter((value) => typeof value === "string" && value))];
}

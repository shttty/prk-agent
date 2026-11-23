
export function catalogMimeTypes(catalog) {
  const limits = catalog?.attachments;
  const values = [...(Array.isArray(limits?.imageMimeTypes) ? limits.imageMimeTypes : []), ...(Array.isArray(limits?.textMimeTypes) ? limits.textMimeTypes : [])];
  return [...new Set(values.filter((value) => typeof value === "string" && value))];
}



export function textOf(ctx, value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(ctx.textOf).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (value.content !== undefined) return ctx.textOf(value.content);
  }
  return "";
}

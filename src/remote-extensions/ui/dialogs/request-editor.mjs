export function editor(ctx, owner, operation, title, prefill) {
  return ctx.reverseRequest(owner, operation.id, "ui", { method: "editor", args: [title, prefill] });
}

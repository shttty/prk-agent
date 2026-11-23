

export function sanitizeError(ctx, error) {
  let text;
  if (error instanceof AggregateError) {
    text = `${error.message}: ${error.errors.map((entry) => ctx.sanitizeError(entry)).join("; ")}`;
  } else {
    text = error instanceof Error ? error.message : String(error);
  }
  if (ctx.runtimeRoot) text = text.replaceAll(ctx.runtimeRoot, "[owned-runtime]");
  return text;
}

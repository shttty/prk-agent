
export const isDirty = (ctx, file) => Boolean(file) && file.content !== file.original;

export const isDirtyPath = (ctx, path) => isDirty(ctx, ctx.files.get(path));

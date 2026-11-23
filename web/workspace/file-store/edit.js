
export const edit = (ctx, path, content) => ctx.patch(path, { content, saveError: "" });


export function forget(ctx, path) { if (ctx.files.delete(path)) ctx.emit(); }

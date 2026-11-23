
export function reloadOpen(ctx, paths) { for (const path of paths) if (ctx.files.has(path)) void ctx.load(path); }

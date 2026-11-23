
export const patch = (ctx, path, changes) => {
    const file = ctx.files.get(path);
    if (!file) return;
    ctx.files.set(path, { ...file, ...(typeof changes === "function" ? changes(file) : changes) });
    ctx.emit();
  };

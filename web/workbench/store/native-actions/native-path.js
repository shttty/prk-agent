
export function nativePath(ctx, name) {
    return `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/native`;
  }


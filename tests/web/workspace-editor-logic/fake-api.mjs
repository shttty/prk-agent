// ── file store ──


export function fakeApi(ctx, disk) {
  const calls = [];
  let clock = 0;
  return {
    calls,
    disk,
    async post(url, body) {
      calls.push({ url: url.split("/").pop(), body });
      const file = disk.get(body.path);
      if (url.endsWith("/read")) {
        if (!file) throw Object.assign(new Error("gone"), { code: "NOT_FOUND" });
        return { content: file.content, format: "text", last_modified: String(file.mtime), mimetype: "text/plain", writable: true };
      }
      if (body.expectedLastModified && body.expectedLastModified !== String(file.mtime)) throw Object.assign(new Error("modified"), { code: "CONFLICT" });
      disk.set(body.path, { content: body.content, mtime: ++clock + 100 });
      return { last_modified: String(clock + 100) };
    },
  };
}

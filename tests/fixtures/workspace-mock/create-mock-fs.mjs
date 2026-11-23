const parentOf = (path) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const failure = (status, code, message) => ({ status, code, message });

/** Flat `{ "dir/file.txt": "content" }` -> an in-memory tree behind the Gateway's files routes. */
export function createMockFs(initial = {}) {
  let clock = 1_000;
  const files = new Map(Object.entries(initial).map(([path, content]) => [path, { content, mtime: ++clock }]));
  const dirs = () => {
    const out = new Set([""]);
    for (const path of files.keys()) for (let dir = parentOf(path); dir; dir = parentOf(dir)) out.add(dir);
    return out;
  };
  const stamp = (mtime) => new Date(mtime).toISOString();
  const need = (path) => files.get(path) ?? (() => { throw failure(404, "NOT_FOUND", "not found"); })();
  const fs = {
    files,
    writes: [],
    reads: [],
    /** Change a file behind the UI's back (agent edit): bumps its mtime so the next save conflicts. */
    external(path, content) { files.set(path, { content, mtime: ++clock }); },
    handle(route, body) {
      if (route === "list") {
        const dir = body.path ?? "";
        if (!dirs().has(dir)) throw failure(404, "NOT_FOUND", "not found");
        const entries = [];
        for (const path of files.keys()) if (parentOf(path) === dir) entries.push({ name: path.slice(dir ? dir.length + 1 : 0), path, type: "file" });
        for (const path of dirs()) if (path && parentOf(path) === dir) entries.push({ name: path.slice(dir ? dir.length + 1 : 0), path, type: "directory" });
        return { path: dir, entries };
      }
      if (route === "read") {
        const file = need(body.path);
        fs.reads.push(body.path);
        return { content: file.content, format: "text", last_modified: stamp(file.mtime), mimetype: "text/plain", writable: true };
      }
      if (route === "write") {
        const file = need(body.path);
        if (body.expectedLastModified && body.expectedLastModified !== stamp(file.mtime)) throw failure(409, "CONFLICT", "modified");
        files.set(body.path, { content: body.content, mtime: ++clock });
        fs.writes.push(body.path);
        return { last_modified: stamp(clock) };
      }
      if (route === "create") {
        if (files.has(body.path) || dirs().has(body.path)) throw failure(409, "CONFLICT", "exists");
        if (body.type === "directory") files.set(`${body.path}/.keep`, { content: "", mtime: ++clock });
        else files.set(body.path, { content: body.content ?? "", mtime: ++clock });
        return {};
      }
      if (route === "rename") {
        for (const [path, file] of [...files]) {
          if (path === body.path || path.startsWith(`${body.path}/`)) { files.delete(path); files.set(body.newPath + path.slice(body.path.length), file); }
        }
        return {};
      }
      if (route === "delete") {
        for (const path of [...files.keys()]) if (path === body.path || path.startsWith(`${body.path}/`)) files.delete(path);
        return {};
      }
      return {};
    },
  };
  return fs;
}


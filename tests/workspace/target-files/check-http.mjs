import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function checkHttp(gateway) {
  const base = `/api/sessions/${gateway.sessionId}`;
  const post = async (path, body, status = 200) => {
    if (path.includes("/files/")) body = { target: "owned", ...body };
    const response = await fetch(`${gateway.url}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: gateway.url }, body: JSON.stringify(body) });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  };
  const root = gateway.context().cwd;
  const path = `${root}/http-file.txt`;
  await post(`${base}/files/create`, { path, type: "file", content: "HTTP→Gateway→target" });
  const opened = await post(`${base}/files/read`, { path });
  assert.equal(opened.content, "HTTP→Gateway→target");
  assert.match(opened.last_modified, /^mtime:/u);
  const conflict = await post(`${base}/files/write`, { path, content: "wrong", format: "text", expectedLastModified: "mtime:0" }, 409);
  assert.equal(conflict.code, "CONFLICT");
  assert.equal((await post(`${base}/files/read`, { path })).content, opened.content);
  const listing = await post(`${base}/files/list`, { path: root });
  assert.ok(listing.entries.some((entry) => entry.path === path));
  assert.equal(typeof listing.truncated, "boolean");
  for (const bad of ["", "relative", "~/bad", `${root}/../bad`]) await post(`${base}/files/read`, { path: bad }, 400);
  await post(`${base}/files/read`, { path, extra: 1 }, 400);
  await post(`${base}/files/write`, { path, content: "bad", format: "text", expectedLastModified: "2026-01-01" }, 400);
  const action = (name, args) => post(`${base}/native`, { requestId: randomUUID(), action: name, args });
  const candidates = await action("reference-candidates", { target: "owned", sessionId: gateway.sessionId, path: "http" });
  assert.equal(candidates.data.truncated, false);
  assert.ok(candidates.data.candidates.some((entry) => entry.path === path));
  const reference = await action("reference-read", { target: "owned", sessionId: gateway.sessionId, path });
  assert.equal(reference.data.content, opened.content);
  await post(`${base}/native`, { requestId: randomUUID(), action: "reference-candidates", args: { target: "wrong", sessionId: gateway.sessionId, path: "" } }, 400);
  const browse = await post("/api/targets/browse", { connection: { target: "owned", url: "http://127.0.0.1:1", cwd: root }, path: root });
  assert.equal(browse.path, root);
  assert.equal(browse.atRoot, false);
  assert.equal(typeof browse.truncated, "boolean");
  await post(`${base}/files/read`, { target: undefined, path }, 400);
  gateway.retarget({ target: "new-owned" });
  for (const method of ["write", "delete"]) {
    const refused = await post(`${base}/files/${method}`, method === "write" ? { path, content: "WRONG TARGET", format: "text" } : { path }, 400);
    assert.equal(refused.code, "INVALID_REQUEST");
    assert.equal(refused.details.reason, "target-mismatch");
  }
  assert.equal((await post(`${base}/files/read`, { target: "new-owned", path })).content, opened.content);
  gateway.retarget({ target: "owned" });
  await post(`${base}/files/delete`, { path });
  console.log(JSON.stringify({ check: "http-wire-target", status: "PASS", url: gateway.url, sessionId: gateway.sessionId }));
}

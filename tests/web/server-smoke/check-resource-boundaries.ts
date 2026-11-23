import assert from "node:assert/strict";
import { WireError } from "../../../src/gateway/wire/create-error.ts";
import type { createGatewayFixture } from "../../fixtures/web-server-smoke/create-gateway-fixture.ts";
import type { createWebRequest } from "../../fixtures/web-server-smoke/create-web-request.ts";

export async function checkResourceBoundaries(
  { record, failNext }: ReturnType<typeof createGatewayFixture>,
  raw: ReturnType<typeof createWebRequest>, primary: { sessionId: string }, spare: { sessionId: string },
): Promise<void> {
  // Code-mode routes preserve the browser boundary, exact wire schemas and
  // Gateway failures, including path-owned identities on destructive actions.
  const codeRoutes = [
    { path: `/api/sessions/${primary.sessionId}/kernel/clear`, method: "POST", body: "{}" },
    { path: `/api/sessions/${primary.sessionId}/kernel/restart`, method: "POST", body: "{}" },
    { path: `/api/sessions/${primary.sessionId}/kernel/variables`, method: "GET" },
    { path: `/api/sessions/${primary.sessionId}/kernel/variables/delete`, method: "POST", body: '{"name":"scratch"}' },
    { path: `/api/sessions/${primary.sessionId}/monitor/focus`, method: "POST", body: '{"open":true}' },
    { path: `/api/sessions/${primary.sessionId}/monitor/diff`, method: "POST", body: '{"path":"src/a.py"}' },
    { path: "/api/tools/list", method: "POST", body: '{"target":"alpha worker"}' },
    ...["promote", "demote", "archive", "restore", "delete"].map((action) => ({ path: `/api/tools/triple/${action}`, method: "POST", body: "{}" })),
  ];
  for (const { path, method, body } of codeRoutes) {
    const before = record.codeMode;
    for (const options of [
      { method, body, headers: { Host: "attacker.invalid" } },
      { method, body, headers: { Origin: "https://attacker.invalid" } },
      { method, body, headers: { "Sec-Fetch-Site": "cross-site" } },
      ...(method === "POST" ? [{ method, body, origin: false }] : []),
    ]) assert.equal((await raw(path, options)).status, 403, path);
    assert.equal((await raw(path, { method: method === "GET" ? "POST" : "GET", body: method === "GET" ? "{}" : undefined })).status, 405, path);
    assert.equal((await raw(`${path}?target=alpha`, { method, body })).status, path.startsWith("/api/sessions/") ? 404 : 400, path);
    if (method === "POST") assert.equal((await raw(path, { body: '{"extra":true}' })).status, 400, path);
    assert.equal(record.codeMode, before, "Rejected requests never reach the Gateway");
    const failure = await raw(path, { method, body });
    assert.equal(failure.status, 404, path);
    assert.equal(JSON.parse(failure.body).code, "NOT_FOUND");
  }
  for (const [path, body] of [
    [`/api/sessions/${primary.sessionId}/kernel/clear`, { sessionId: spare.sessionId }],
    [`/api/sessions/${primary.sessionId}/kernel/variables/delete`, { name: "" }],
    [`/api/sessions/${primary.sessionId}/monitor/focus`, { open: "yes" }],
    [`/api/sessions/${primary.sessionId}/monitor/diff`, { path: "" }],
    ["/api/tools/triple/delete", { name: "other" }],
    ["/api/tools/not-a-python-name/promote", {}],
    ["/api/tools/%2F/delete", {}],
    ["/api/tools/list", { target: "../other" }],
  ] as const) assert.equal((await raw(path, { body: JSON.stringify(body) })).status, 400, path);
  failNext("codeMode", new WireError("BUSY", "Kernel is executing."));
  assert.equal((await raw(`/api/sessions/${primary.sessionId}/kernel/clear`, { body: "{}" })).status, 409);
  failNext("codeMode", new WireError("UNAVAILABLE", "Kernel has not started; no implicit wake."));
  assert.equal((await raw(`/api/sessions/${primary.sessionId}/kernel/variables`)).status, 503);
  failNext("codeMode", new WireError("CLIENT_ERROR", "Gateway disconnected; outcome unknown."));
  assert.equal((await raw("/api/tools/triple/delete", { body: "{}" })).status, 503);
}

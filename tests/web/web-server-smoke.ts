import { checkListenerHosts } from "../fixtures/web-server-smoke/check-listener-hosts.ts";
import assert from "node:assert/strict";
import { WireError } from "../../src/gateway/wire/create-error.ts";
import { startWebServer } from "../../src/http/listener/start-listener.ts";
import { validateWebAddress } from "../../src/http/request/validate-web-address.ts";
import { createGatewayFixture } from "../fixtures/web-server-smoke/create-gateway-fixture.ts";
import { createWebRequest } from "../fixtures/web-server-smoke/create-web-request.ts";
import { checkResourceBoundaries } from "./server-smoke/check-resource-boundaries.ts";
import { checkObservationStream } from "./server-smoke/check-observation-stream.ts";

// Fast contract for the browser adapter. No browser, no Jupyter, no SDK.
//
// The fake below stands in for the Gateway/Agent host that owns every worker
// session and kernel. Because it is the only source of state, anything an HTTP
// response contains that the fake never supplied would be state this web
// process invented, and every worker lifecycle effect must be visible as an
// explicit call recorded here.

const fixture = createGatewayFixture();
const { gateway, ENVIRONMENT, record, sessions, publicSession, requireSession, snapshotOf, workbenchValue, failNext } = fixture;

validateWebAddress("127.0.0.1", 0);
validateWebAddress("0.0.0.0", 0);
for (const host of ["localhost", "example.invalid", "203.0.113.10", "2001:db8::1", "::"]) {
  assert.doesNotThrow(() => validateWebAddress(host, 0), `Web host ${host} is not range-restricted`);
}
assert.doesNotThrow(() => validateWebAddress("example.invalid", 65_535), "maximum Web port is accepted");
for (const port of [-1, 65_536, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => validateWebAddress("example.invalid", port), (error: unknown) => error instanceof WireError && error.code === "CLI_ERROR", `invalid Web port ${port} is rejected`);
}

const web = await startWebServer(gateway, { port: 0 });
const origin = web.url;
// Node's fetch normalizes Host, so every fixed-header case uses native HTTP.
const raw = createWebRequest(origin);

try {
  // The listener serves only /api: the root is plain not-found JSON,
  // never a document, and every response forbids rendering.
  for (const path of ["/"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 404, `API-only listener does not serve ${path}`);
    assert.match(response.headers.get("content-type") || "", /^application\/json/, `${path} answers JSON, not a page`);
    assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'", `${path} carries the API response policy`);
    assert.doesNotMatch(await response.text(), /<html|<script/i, `${path} returns no markup`);
  }
  assert.equal((await fetch(`${origin}/api/workbench`)).headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'", "API responses forbid rendering");

  // /api/workbench forwards the Gateway's own value with nothing added.
  let response = await raw("/api/workbench");
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), workbenchValue(), "Workbench is forwarded verbatim; the web process adds no metadata of its own");
  // The kernelspec catalog route is gone with Jupyter.
  response = await raw(`/api/targets/${encodeURIComponent(ENVIRONMENT)}/kernels`);
  assert.equal(response.status, 404, "There is no kernels route");
  // Creation forwards the instance (and an optional cwd) only, then merges Gateway metadata.
  response = await raw("/api/sessions", { body: JSON.stringify({ target: ENVIRONMENT }) });
  assert.equal(response.status, 201);
  const primaryCreated = JSON.parse(response.body);
  const primary = primaryCreated.session;
  assert.deepEqual(record.create, [ENVIRONMENT], "Creation forwards exactly the instance");
  assert.equal(primary.cwd, "/workspace", "The session reports the cwd the Gateway chose");
  assert.equal(Object.hasOwn(primary, "kernelName"), false, "Sessions carry no kernelspec");
  const primarySession = requireSession(primary.sessionId);
  assert.deepEqual(primaryCreated, { session: publicSession(primarySession), snapshot: snapshotOf(primarySession) }, "201 returns the native session and its host snapshot");
  assert.notEqual(primary.sessionId, ENVIRONMENT, "Routing identity is not the instance ID");
  assert.equal(primary.sessionId, primaryCreated.snapshot.sessionId, "Routing identity is the SDK session id");
  assert.equal(Object.hasOwn(primary, "name"), false, "There is no second session routing key");
  response = await raw("/api/sessions", { body: JSON.stringify({ target: ENVIRONMENT }) });
  assert.equal(response.status, 201);
  const spare = JSON.parse(response.body).session;
  assert.notEqual(spare.sessionId, primary.sessionId);

  // Snapshot reads forward the routing identity.
  response = await raw(`/api/sessions/${encodeURIComponent(primary.sessionId)}`);
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), snapshotOf(primarySession));
  assert.equal(record.state.at(-1), primary.sessionId);

  await checkResourceBoundaries(fixture, raw, primary, spare);


  // send forwards exactly the validated parameters, and the routing identity
  // comes from the path even when the body claims another worker.
  response = await raw(`/api/sessions/${encodeURIComponent(primary.sessionId)}/send`, {
    body: JSON.stringify({ requestId: "request-1", message: "hello", sessionId: spare.sessionId }),
  });
  assert.equal(response.status, 400);
  assert.equal(record.send.length, 0, "A body-supplied session identity is rejected before Gateway dispatch");
  response = await raw(`/api/sessions/${encodeURIComponent(primary.sessionId)}/send`, {
    body: JSON.stringify({ requestId: "request-1", message: "hello" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(record.send.at(-1), { sessionId: primary.sessionId, params: { requestId: "request-1", message: "hello", source: "web" } },
    "Native routing comes only from the path and HTTP marks the command source");
  response = await raw(`/api/sessions/${encodeURIComponent(primary.sessionId)}/send`, {
    body: JSON.stringify({ requestId: "request-2", message: "queued", queue: "steer" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(record.send.at(-1), { sessionId: primary.sessionId, params: { requestId: "request-2", message: "queued", queue: "steer", source: "web" } });
  const sendsBeforeInvalid = record.send.length;
  response = await raw(`/api/sessions/${encodeURIComponent(primary.sessionId)}/send`, {
    body: JSON.stringify({ requestId: "request-3", message: "bad", queue: "asap" }),
  });
  assert.equal(response.status, 400);
  assert.equal(record.send.length, sendsBeforeInvalid, "Rejected sends are never forwarded");

  response = await raw(`/api/sessions/${encodeURIComponent(primary.sessionId)}/cancel`, {
    body: JSON.stringify({ operationId: "operation-1", sessionId: spare.sessionId }),
  });
  assert.equal(response.status, 400);
  assert.equal(record.cancel.length, 0, "A body identity cannot redirect cancellation");
  response = await raw(`/api/sessions/${encodeURIComponent(primary.sessionId)}/cancel`, { body: JSON.stringify({ operationId: "operation-1" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(record.cancel.at(-1), { sessionId: primary.sessionId, operationId: "operation-1" },
    "Cancellation routes by path identity with exactly the validated operation id");

  await checkObservationStream(fixture, origin, primary);

  // Browser boundary: exact Host, matching Origin, Origin required to mutate,
  // and no cross-site fetches.
  for (const [path, options, expected, description] of [
    ["/api/workbench", { headers: { Host: "attacker.invalid" } }, 403, "exact Host required"],
    ["/api/workbench", { headers: { Origin: "https://attacker.invalid" } }, 403, "Origin must match"],
    ["/api/sessions", { body: JSON.stringify({ target: ENVIRONMENT }), origin: false }, 403, "mutation requires Origin"],
    ["/api/sessions", { body: JSON.stringify({ target: ENVIRONMENT }), headers: { "Sec-Fetch-Site": "cross-site" } }, 403, "cross-site refused"],
    ["/api/sessions", { method: "GET" }, 405, "creation is POST only"],
    ["/api/sessions", { body: JSON.stringify({ target: ENVIRONMENT, extra: true }) }, 400, "extra creation key"],
    ["/api/sessions", { body: JSON.stringify({ target: ENVIRONMENT, kernelName: "python3" }) }, 400, "the removed kernelName is not an alias"],
    ["/api/sessions", { body: "{invalid" }, 400, "invalid JSON"],
    ["/api/sessions", { body: " ".repeat(1024 * 1024 + 1) }, 413, "oversized body"],
    ["/api/sessions", { body: JSON.stringify({ target: ENVIRONMENT }), headers: { "Content-Type": "text/plain" } }, 415, "non-JSON content type"],
    ["/api/sessions/%GG", {}, 400, "invalid percent encoding"],
    [`/api/sessions/${encodeURIComponent(primary.sessionId)}/unsupported`, { body: "{}" }, 404, "unknown worker action"],
    [`/api/sessions/${encodeURIComponent(primary.sessionId)}/events`, { method: "POST", body: "{}" }, 405, "events is GET only"],
    ["/api/workbench?probe=1", {}, 400, "query parameters refused"],
    ["/api/workers", { body: JSON.stringify({ target: ENVIRONMENT }) }, 404, "retired collection route"],
    [`/api/sessions/${primary.sessionId}/send`, { body: JSON.stringify({ requestId: "old-key", message: "text", worker: spare.sessionId }) }, 400, "retired identity field"],
    [`/api/sessions/${primary.sessionId}/send`, { body: JSON.stringify({ requestId: "forged-source", message: "text", source: "web" }) }, 400, "HTTP owns command source"],
  ] as const) {
    const rejected = await raw(path, options);
    assert.equal(rejected.status, expected, `${description} (${path})`);
  }
  const createsBeforeFailures = record.create.length;
  const managedBeforeFailures = [...sessions.values()]
    .map(({ sessionId }) => ({ sessionId }))
    .sort((left, right) => left.sessionId.localeCompare(right.sessionId));

  // An unreachable Gateway is reported as unavailable and creates nothing.
  failNext("workbench", new WireError("CLIENT_ERROR", "Gateway is unavailable; worker sessions are owned by the Gateway and this web service never starts a substitute host."));
  response = await raw("/api/workbench");
  assert.equal(response.status, 503, "Gateway unavailability is an explicit service error");
  assert.match(JSON.parse(response.body).error, /unavailable/i);
  failNext("createSession", new WireError("CLIENT_ERROR", "Gateway connection lost; request outcome unknown."));
  response = await raw("/api/sessions", { body: JSON.stringify({ target: ENVIRONMENT }) });
  assert.equal(response.status, 503);
  assert.equal(record.create.length, createsBeforeFailures, "An unavailable Gateway receives no create call");
  assert.deepEqual(
    [...sessions.values()].map(({ sessionId }) => ({ sessionId })).sort((left, right) => left.sessionId.localeCompare(right.sessionId)),
    managedBeforeFailures,
    "An unavailable Gateway creates no managed session",
  );

  // Gateway failure codes map to explicit HTTP status codes.
  failNext("state", new WireError("NOT_FOUND", "Worker identity is not managed by this Gateway."));
  assert.equal((await raw(`/api/sessions/${encodeURIComponent(primary.sessionId)}`)).status, 404);
  assert.equal((await raw("/api/sessions/unknown-routing-identity")).status, 404, "An unknown identity is 404, never a new session");
  failNext("state", new WireError("TOO_LARGE", "Result exceeds output limit; no partial snapshot is returned."));
  assert.equal((await raw(`/api/sessions/${encodeURIComponent(primary.sessionId)}`)).status, 413);
  failNext("send", new WireError("INVALID_REQUEST", "Invalid v1 request envelope or method parameters."));
  assert.equal((await raw(`/api/sessions/${encodeURIComponent(primary.sessionId)}/send`, { body: JSON.stringify({ requestId: "r", message: "m" }) })).status, 400);


  // The web listener stops; the Gateway keeps every session and kernel.
  await web.close();
  await web.closed;
  assert.equal(record.gatewayClose, 0, "Stopping the HTTP listener must not close the Gateway client");
  assert.equal(primarySession.sinks.size, 0, "Only observation is released");
} finally {
  await web.close().catch(() => {});
}

await checkListenerHosts(gateway, raw, ENVIRONMENT);
console.log("PASS web adapter HTTP contract: API-only responses; path-routed workbench/create/state/send/cancel; SSE snapshot-first host events without Web-side refetch; Host/Origin/Sec-Fetch-Site/method/body/encoding boundaries; Gateway error status mapping; listener shutdown preserves Gateway ownership");

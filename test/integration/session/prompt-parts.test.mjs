import assert from "node:assert/strict";
import { test } from "node:test";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";
import { startCompletionsEndpoint } from "../../fixtures/models/start-completions-endpoint.mjs";

test("tools, messages and raw are the request the provider received, and each request is announced once", async (t) => {
  const endpoint = await startCompletionsEndpoint(t);
  const f = await gatewayFixture(t, { web: true, endpoint, config: { session: { workerTools: "code" } } });
  await f.stageArtifacts();
  const id = await f.create();
  const announced = [];
  const subscription = f.host.session(id).subscribe(({ type, details }) => { if (type === "state_changed" && details?.prompt) announced.push(details.prompt.requests); });
  t.after(subscription.unsubscribe);
  const get = async (path) => {
    const response = await fetch(`${f.url}/api/sessions/${id}/prompt${path}`, { headers: { Origin: f.url } });
    return { status: response.status, body: await response.json() };
  };
  const turn = async (message) => assert.equal((await f.complete(id, await f.send(id, message))).status, "completed");

  assert.equal((await get("/tools")).status, 404, "nothing is captured before the first request");
  assert.deepEqual([announced, f.state(id).prompt], [[], undefined]);

  await turn("First question");
  await turn("Second question");
  assert.deepEqual([announced, f.state(id).prompt], [[1, 2], { requests: 2 }]);
  const wire = endpoint.bodies[1];
  const [report, tools, raw] = await Promise.all([get(""), get("/tools"), get("/raw")]);
  assert.equal(report.body.latest.seq, 2);

  assert.deepEqual(raw.body, { sessionId: id, seq: 2, at: report.body.latest.at, shape: "chat", payload: wire });
  assert.deepEqual(tools.body.tools.map(({ declaration }) => declaration), wire.tools);
  assert.equal(tools.body.tools.find(({ name }) => name === "kernel_code").exposure, "model-only");
  const conversation = wire.messages.slice(1);
  const pages = [];
  for (let offset = 0; offset < conversation.length; offset += 2) pages.push((await get(`/messages?offset=${offset}&limit=2`)).body);
  assert.deepEqual(pages.flatMap((page) => page.messages), conversation);
  assert.deepEqual(pages.flatMap((page) => page.outline.map(({ role }) => role)), conversation.map(({ role }) => role));
  assert.deepEqual([pages[0].total, pages[0].turnStart, pages[0].seq], [conversation.length, conversation.length - 1, 2]);
  assert.equal((await get("/messages")).body.messages.length, conversation.length, "the default page holds the whole short conversation");
  assert.deepEqual((await get(`/messages?offset=${conversation.length}`)).body.messages, []);

  const everything = JSON.stringify([raw.body, tools.body, pages]);
  assert.doesNotMatch(everything, new RegExp(endpoint.apiKey));
  assert.deepEqual(Object.keys(raw.body.payload), Object.keys(wire));

  for (const bad of ["/messages?limit=0", "/messages?limit=201", "/messages?offset=-1", "/messages?offset=1&offset=2", "/tools?offset=1", "/raw?limit=1", "/messages?skip=1"]) assert.equal((await get(bad)).status, 400, bad);
  assert.equal((await get("/unknown")).status, 404);
  assert.deepEqual(announced, [1, 2], "reading announces nothing");
});

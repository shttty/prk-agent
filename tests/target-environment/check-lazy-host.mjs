import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getCurrentTools } from "@earendil-works/pi-ai";
import { createGatewayFixture } from "./host/create-gateway-fixture.mjs";

const fixture = await createGatewayFixture("local");
const { host, sessionId, generations, contexts } = fixture;
try {
  assert.equal(generations.length, 0, "Tools-only session creation must not start a Pi host");
  const enabled = await host.nativeAction(sessionId, { sessionId, requestId: randomUUID(), action: "local-tools", args: { enabled: true } });
  assert.equal(enabled.status, "completed", JSON.stringify(enabled));
  const prompt = await host.session(sessionId).submit({ requestId: randomUUID(), message: "Observe declarations without calling a tool." });
  assert.equal((await prompt.completion).status, "completed");
  const names = new Set(getCurrentTools(contexts.at(-1).messages).map((tool) => tool.name));
  for (const name of ["read", "write", "edit", "bash", "grep", "find", "ls"]) assert(names.has(name), name);
  assert.equal(generations.length, 0, "Declaring all seven tools must not deploy/start a Pi host");
  const first = await fixture.submit("write", { path: "lazy.txt", content: "LAZY_TARGET\n" });
  assert.equal((await first.completion).status, "completed");
  const result = host.state(sessionId).messages.findLast((message) => message.role === "toolResult" && message.toolName === "write");
  assert(result && !result.isError, JSON.stringify(result));
  assert.equal(generations.length, 1);
  assert.notEqual(generations[0].registration.pid, process.pid);
  console.log(JSON.stringify({ status: "PASS", mode: "local", sevenDeclarationsWithoutHost: true,
    firstExecutionStartsHost: true, hostPid: generations[0].registration.pid }));
} finally { await fixture.close(); }

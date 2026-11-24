import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { gatewayFixture, text, tool } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

test("real child tools deliver a result and notify the owner of an unsuccessful run", async (t) => {
  const f = await gatewayFixture(t, { answer(context) {
    const body = text(context.messages.at(-1));
    if (body.includes("# Your assignment\nRESULT_CHILD")) return tool("session_result", { summary: "Delivered verification result" });
    if (body.includes("# Your assignment\nFAIL_CHILD")) return fauxAssistantMessage([], { stopReason: "error", errorMessage: "Verification child failed" });
  } });
  await f.deploy();
  const owner = await f.create("Owner");
  const spawn = (task) => f.send(owner, `TOOL ${JSON.stringify({ name: "session_spawn", args: { context: "Verification", tasks: [{ task, label: task }] } })}`);
  const findReceipt = (pattern, name) => until(() => f.state(owner).messages.find((message) => pattern.test(text(message)) && message.role !== "toolResult"), name);
  assert.equal((await f.complete(owner, await spawn("RESULT_CHILD"))).status, "completed");
  await findReceipt(/Delivered verification result/, "owner result receipt");
  await until(() => !f.state(owner).operation, "owner idle after receipt");
  const archived = await until(async () => (await f.request("workbench")).archive.flatMap((group) => group.sessions)
    .find((row) => row.label === "RESULT_CHILD"), "temporary child archived after delivery");
  assert.notEqual(archived.sessionId, owner);
  assert.equal(archived.owner, owner);
  assert.equal((await f.complete(owner, await spawn("FAIL_CHILD"))).status, "completed");
  const failed = await findReceipt(/派生会话运行失败/, "owner failure notice");
  assert.match(text(failed), /FAIL_CHILD/);
  assert.match(text(failed), /Verification child failed/);
  const row = (await f.request("workbench")).sessions.find((item) => item.label === "FAIL_CHILD");
  assert(row && text(failed).includes(row.sessionId), "failure notice names the retained child");
});

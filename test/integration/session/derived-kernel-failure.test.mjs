import assert from "node:assert/strict";
import test from "node:test";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";
import { gatewayFixture, text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

const call = (f, id, name, args) => f.send(id, `TOOL ${JSON.stringify({ name, args })}`);

test("a real child kernel exit notifies the owner only once per failed generation", async (t) => {
  const f = await gatewayFixture(t);
  await f.deploy();
  const owner = await f.create("Owner");
  const label = "Kernel child";
  const spawn = await call(f, owner, "session_spawn", { context: "Verification", tasks: [{ task: "Await the next instruction", label }] });
  assert.equal((await f.complete(owner, spawn)).status, "completed");
  const row = (await f.request("workbench")).sessions.find((item) => item.label === label);
  assert(row);
  const child = row.sessionId;
  await until(() => !f.state(child).operation, "child idle after its assignment");
  const unavailable = [];
  const sub = f.host.session(child).subscribe(({ type, details }) => {
    if (type === "state_changed" && details?.kernel?.state === "unavailable") unavailable.push(details.kernel.kernelId);
  });
  t.after(sub.unsubscribe);
  const notices = () => f.state(owner).messages.filter((message) => message.role === "user").flatMap((message) =>
    (parsePeerMessages(text(message)) ?? []).filter(({ sender, body }) => sender === child && body.startsWith("[派生会话运行失败 / child=")))
    .map((message) => ({ ...message, failure: JSON.parse(message.body.split("\n")[1]) }))
    .filter(({ failure }) => failure.kernelId !== undefined);
  const start = async () => {
    const receipt = await call(f, child, "kernel_code", { code: "print('kernel ready')", mode: "thread" });
    assert.equal((await f.complete(child, receipt)).status, "completed");
    const output = text(f.state(child).messages.findLast((message) => message.role === "toolResult"));
    assert.match(output, /^kernel ready$/m);
    const kernel = f.state(child).kernel;
    assert.equal(kernel.state, "idle");
    assert(kernel.kernelId);
    return kernel.kernelId;
  };
  const orderly = await start();
  assert.notEqual((await f.request("kernelRestart", { sessionId: child })).kernelId, orderly);
  const failedGenerations = [];
  for (let i = 0; i < 2; i++) {
    const kernelId = await start();
    assert.notEqual(kernelId, orderly);
    assert(!failedGenerations.includes(kernelId));
    failedGenerations.push(kernelId);
    // Write a malformed event through the actual runner protocol; Gateway must retire the process.
    const broken = await call(f, child, "kernel_code", { code: [
      "from _prk_runtime import current_cell",
      "current_cell.func.__globals__['emit_message'](current_cell.args[0], 'invalid_fixture_event')",
    ].join("\n"), mode: "thread" });
    assert.equal((await f.complete(child, broken)).status, "unknown");
    await until(() => unavailable.filter((id) => id === kernelId).length >= 2, "repeated unavailable state for the retired kernel");
    const received = await until(() => notices().length >= i + 1 && notices(), "owner receipt for child kernel exit", 5_000);
    await until(() => !f.state(owner).operation, "owner idle after the failure notice");
    assert.equal(notices().length, i + 1);
    const { body, expectReply, failure } = received[i];
    assert.equal(expectReply, false);
    assert.equal(body.split("\n")[0], `[派生会话运行失败 / child=${child}]`);
    assert.deepEqual(failure, { type: "failed", sessionId: child, sessionName: label, kernelId,
      kernelState: "unavailable", summary: "Invalid kernel event." });
  }
});

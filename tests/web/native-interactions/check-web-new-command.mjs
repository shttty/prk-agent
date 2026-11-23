import assert from "node:assert/strict";

export async function checkWebNewCommand(ctx) {
  const text = "  /new";
  const before = await ctx.state(ctx.desktop, ctx.main);
  const modelCalls = ctx.modelCalls;
  const rejected = await ctx.sendUi(ctx.desktop, text);
  assert.equal(rejected.accepted, false, "Web auto send refuses /new");
  assert.equal(rejected.executed, false, "Web refusal does not execute the command");
  assert.equal(rejected.plainSendAvailable, true, "the explicit plain-text path remains available");
  assert.equal(ctx.modelCalls, modelCalls, "refusing /new does not call the provider");
  assert.deepEqual((await ctx.state(ctx.desktop, ctx.main)).messages, before.messages, "the source SDK history remains unchanged");
  await ctx.desktop.locator("#send-as-plain").click();
  const sent = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/sessions/${ctx.main}/send`);
  const admitted = await ctx.sendUi(ctx.desktop, text);
  assert.equal(admitted.accepted, true, "plain /new is ordinary user text");
  assert.deepEqual({ message: (await sent).request().postDataJSON().message, mode: (await sent).request().postDataJSON().mode }, { message: text, mode: "plain" });
  await ctx.waitForIdle(ctx.desktop, ctx.main, admitted.operationId);
  const snapshot = await ctx.state(ctx.desktop, ctx.main);
  assert.equal(snapshot.sessionId, ctx.main, "plain /new keeps the selected native session");
  const user = snapshot.messages.filter((message) => message.role === "user").at(-1);
  const recorded = typeof user.content === "string" ? user.content : user.content.filter((part) => part.type === "text").map((part) => part.text).join("");
  assert.equal(recorded, text, "plain sends the original text without slash expansion");
}

import assert from "node:assert/strict";

export async function checkRenderingSeams({ faux, send, main, worker, until, render, action, client, host, command, cc, nextCounter, fauxAssistantMessage, fauxToolCall }) {
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall("probe_default", { argument: "default", hold: true }), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("probe_self", { argument: "self" }), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("probe_resolved", { argument: "resolved" }), { stopReason: "toolUse" }),
    fauxAssistantMessage("PROBE_COMPLETE"),
  ]);
  const tools = await send(main.session.sessionId, "controlled tool renderer round");
  const partial = await until(() => render(main.session.sessionId), (value) => Object.values(value.tools).some((item) => item.result && JSON.stringify(item.result).includes("partial")), "partial result renderer");
  const hold = partial.prompts.find((prompt) => prompt.kind === "confirm");
  assert.ok(hold);
  await action(main.session.sessionId, { operation: "dialog", id: hold.id, value: true });
  assert.equal((await tools.completion).status, "completed");
  const final = await render(main.session.sessionId);
  assert.ok(Object.values(final.tools).some((item) => item.shell === "self" && item.result && JSON.stringify(item.result).includes("final")));
  assert.match(JSON.stringify(final.tools), /resolver call/);
  const expandedToolCallId = Object.keys(final.tools).find((id) => final.tools[id].result);
  assert.ok(expandedToolCallId);
  const expandedRender = await action(main.session.sessionId, { operation: "render", width: 80, height: 40, clientId: "desktop", expandedToolCallIds: [expandedToolCallId] });
  assert.match(JSON.stringify(expandedRender.data.tools[expandedToolCallId]), /expanded/);
  assert.match(JSON.stringify(final.messages), /markdown-transformer:assistant:final/);
  for (const created of [main, worker]) {
    const name = created.session.sessionId;
    faux.setResponses([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error" }),
      fauxAssistantMessage(fauxToolCall("renderer_width", {}), { stopReason: "toolUse" }),
      fauxAssistantMessage("RETRY_UI_FINAL"),
    ]);
    const accepted = await client.request("send", { sessionId: name, requestId: `retry-ui-${nextCounter()}`, message: "Isolated plugin UI retry" });
    assert.equal(accepted.accepted, true);
    const settled = await until(() => client.request("state", { sessionId: name }), (state) => state.recentOperations.some((item) => item.operationId === accepted.operationId), "retry operation settles");
    assert.equal(settled.recentOperations.at(-1).status, "completed");
    assert.equal(settled.state, "idle");
    assert.equal(settled.sessionId, created.session.sessionId);
    assert.ok(Object.values((await render(name)).tools).some((item) => item.result?.lines?.includes("X".repeat(80))), "plugin renderer remains available after successful native retry");
  }
  console.log("PASS retry: real SDK/Gateway/socket main+worker remain idle/completed with extension-ui render available");
  for (const created of [main, worker]) {
    const name = created.session.sessionId;
    for (const [kind, responses] of [
      ["exhausted", [fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error: first attempt" }), fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error: exhausted" })]],
      ["non-retryable", [fauxAssistantMessage("", { stopReason: "error", errorMessage: "Final non-retryable failure" })]],
    ]) {
      faux.setResponses(responses);
      const marker = `GATEWAY_FAILED_${kind}_${created.session.sessionId}`;
      const failed = await client.request("send", { sessionId: name, requestId: `failed-ui-${nextCounter()}`, message: marker });
      assert.equal(failed.accepted, true);
      const afterFailure = await until(() => client.request("state", { sessionId: name }), (state) => state.recentOperations.some((item) => item.operationId === failed.operationId), "failed operation settles");
      assert.equal(afterFailure.recentOperations.at(-1).status, "failed");
      assert.equal(afterFailure.state, "idle", `${kind} provider error leaves the session idle`);
      assert.equal((await action(name, { operation: "render", width: 80, height: 40, clientId: "failure" })).status, "completed", "extension UI renders after an operation failure");
      faux.setResponses([fauxAssistantMessage(`CONTINUED_${kind}`)]);
      const nextMarker = `GATEWAY_NEXT_${kind}_${created.session.sessionId}`;
      const next = await client.request("send", { sessionId: name, requestId: `next-ui-${nextCounter()}`, message: nextMarker });
      assert.equal(next.accepted, true, "the next input is admitted directly");
      const continued = await until(() => client.request("state", { sessionId: name }), (state) => state.recentOperations.some((item) => item.operationId === next.operationId), "next input settles");
      assert.equal(continued.recentOperations.at(-1).status, "completed");
      assert.equal(continued.state, "idle");
      const users = continued.messages.filter((message) => message.role === "user").map((message) => JSON.stringify(message.content));
      for (const text of [marker, nextMarker]) assert.equal(users.filter((item) => item.includes(text)).length, 1, "failed input is kept once and never replayed");
    }
  }
  console.log("PASS failure: exhausted and non-retryable provider errors fail only the operation; main+worker stay idle, extension UI renders, next input runs without replay");
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall("renderer_throw", {}), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("renderer_width", {}), { stopReason: "toolUse" }),
    fauxAssistantMessage("BOUNDARIES_DONE"),
  ]);
  const boundaries = await send(main.session.sessionId, "controlled renderer boundary round");
  assert.equal((await boundaries.completion).status, "completed");
  const narrow = await render(main.session.sessionId, 20, "phone");
  const wide = await render(main.session.sessionId, 80, "desktop");
  if (process.argv.includes("--serve")) {
    // The supervised browser may send additional exploratory prompts after the scripted checks.
    // Keep the owned controlled provider alive for that observation window without network/model calls.
    faux.setResponses(Array.from({ length: 100 }, () => fauxAssistantMessage("SMOKE_FALLBACK")));
  }
  assert.match(JSON.stringify(wide.toolErrors), /CALL_RENDERER_FAILURE/);
  assert.match(JSON.stringify(wide.toolErrors), /RESULT_RENDERER_FAILURE/);
  assert.ok(Object.values(wide.tools).some((item) => item.shell === "self" && !item.call && !item.result), "failed phases leave native fallback available");
  assert.ok(Object.values(narrow.tools).some((item) => item.result?.lines?.includes("X".repeat(20))));
  assert.ok(Object.values(wide.tools).some((item) => item.result?.lines?.includes("X".repeat(80))));
  const lifetimeStart = await send(main.session.sessionId, "/renderer-lifetime start");
  await lifetimeStart.completion;
  await render(main.session.sessionId, 80, "desktop");
  await render(main.session.sessionId, 80, "desktop");
  const lifetimeCount = await send(main.session.sessionId, "/renderer-lifetime count");
  await lifetimeCount.completion;
  assert.equal(host.state(main.session.sessionId).extensionUi.notifications.at(-1).message, "LIFETIME_LIVE=2", "Repeated readonly rendering releases prior message/entry components");
  await render(main.session.sessionId, 20, "phone");
  const phoneLifetime = await send(main.session.sessionId, "/renderer-lifetime count");
  await phoneLifetime.completion;
  assert.equal(host.state(main.session.sessionId).extensionUi.notifications.at(-1).message, "LIFETIME_LIVE=4", "Each active client retains only its current readonly components");
  const errors = await send(main.session.sessionId, "/renderer-errors");
  await errors.completion;
  const fallback = await render(main.session.sessionId);
  assert.match(JSON.stringify(fallback.rendererErrors), /MESSAGE_RENDERER_FAILURE/);
  assert.match(JSON.stringify(fallback.rendererErrors), /ENTRY_RENDERER_FAILURE/);
  assert.match(JSON.stringify(fallback.entries), /RAW_ENTRY_FALLBACK/);
  // Pi's CombinedAutocompleteProvider would list the Gateway's own cwd for paths, `@` and text after a space or CJK
  // punctuation; the PRK composer keeps only its `/` command part (target files come from PRK's own `@` list).
  for (const [text, force] of [["看看这个？", false], ["see ", false], ["@", false], ["./", false], ["~/", false], ["agent/", false], ["notes", true]]) {
    const none = await action(main.session.sessionId, { operation: "autocomplete", clientId: "desktop", lines: [text], cursorLine: 0, cursorCol: text.length, force });
    assert.equal(none.data.status, "completed", JSON.stringify(none));
    assert.equal(none.data.data, null, `no Pi path completion for ${JSON.stringify(text)}${force ? " (forced)" : ""}: ${JSON.stringify(none.data.data)}`);
  }
  // Forced on a `/` line, Combined would skip commands and list Gateway paths (`/pro` -> proc/); the gate keeps commands.
  const forced = await action(main.session.sessionId, { operation: "autocomplete", clientId: "desktop", lines: ["/pro"], cursorLine: 0, cursorCol: 4, force: true });
  assert.deepEqual(forced.data.data.items.map((item) => item.value).sort(), ["probe", "probe-api-command"], JSON.stringify(forced.data.data));
  const commandNames = await action(main.session.sessionId, { operation: "autocomplete", clientId: "desktop", lines: ["/probe-api"], cursorLine: 0, cursorCol: 10 });
  assert.ok(commandNames.data.data.items.some((item) => item.value === "probe-api-command"), "slash command names still complete");
  await command(main.session.sessionId, "autocomplete");
  const suggestions = await action(main.session.sessionId, { operation: "autocomplete", clientId: "desktop", lines: ["/probe-api-command m"], cursorLine: 0, cursorCol: 20 });
  assert.ok(suggestions.data.data.items.some((item) => item.value === "message"), "command argument completions stay");
  const added = await action(main.session.sessionId, { operation: "autocomplete", clientId: "desktop", lines: ["/probe-c"], cursorLine: 0, cursorCol: 8 });
  assert.ok(added.data.data.items.some((item) => item.value === "probe-completion"), "addAutocompleteProvider completions stay");
  await command(main.session.sessionId, "header-reset");
  await command(main.session.sessionId, "footer-reset");
  console.log(`EXTENSION UI SEAM PASS (${cc ? "CC loaded negative sample" : "probe only"}; real SDK/Gateway/socket/HTTP; main+worker; controlled provider only)`);
}

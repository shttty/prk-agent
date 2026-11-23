import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionHandlerScope } from "../../../src/sessions/extension-invocation/assemble-extension-invocation.ts";
import { onError } from "../../../src/sessions/host/extensions/on-error.ts";

test("onError suppresses expected owner-cancel extension aborts and reports real extension errors", async () => {
  const scope = createExtensionHandlerScope();
  const base = { extensions: [{ path: "<inline:probe>", handlers: new Map([["turn_end", [async () => "ok"]]]), tools: new Map(), commands: new Map(), shortcuts: new Map(), flags: new Map(), messageRenderers: new Map() }], errors: [], runtime: {} };
  const overridden = scope.override(base);
  const handler = overridden.extensions[0].handlers.get("turn_end")[0];
  scope.cancel();

  let abortMessage = "";
  try {
    await handler({ type: "turn_end" }, {});
  } catch (error) {
    abortMessage = error instanceof Error ? error.message : String(error);
  }
  assert.ok(abortMessage.length > 0);

  const notifications = [];
  const originalConsoleError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const ctx = { ui: { context: { notify: (message, level) => notifications.push({ message, level }) } } };
    onError(ctx, { extensionPath: "<inline:probe>", event: "turn_end", error: abortMessage });
    assert.deepEqual(notifications, []);
    assert.deepEqual(logged, []);

    onError(ctx, { extensionPath: "<inline:probe>", event: "turn_end", error: "real extension failure" });
    assert.deepEqual(notifications, [{ message: "real extension failure", level: "error" }]);
    assert.equal(logged.length, 1);

    onError(ctx, { extensionPath: "<inline:probe>", event: "provider_policy", error: "provider registration denied" });
    assert.deepEqual(notifications.at(-1), { message: "provider registration denied", level: "error" });
    assert.equal(logged.length, 1, "provider policy already logged its refusal; hosted delivery only notifies the UI");
  } finally {
    console.error = originalConsoleError;
  }
});

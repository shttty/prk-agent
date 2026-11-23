import assert from "node:assert/strict";
import { join } from "node:path";
import { Type } from "typebox";
import { SessionManager, SettingsManager, createAgentSessionServices, createAgentSessionFromServices, defineTool } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createSessionHost } from "../../../src/sessions/host/assemble-host.ts";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";

export async function checkReentrant({ root, modelRuntime, text, until }) {
  const faux = fauxProvider({ provider: "delivery-reentrant", models: [{ id: "test" }], tokensPerSecond: 100_000 });
  modelRuntime.registerNativeProvider(faux.provider);
  faux.setResponses(Array.from({ length: 100 }, () => async (context) => text(context.messages.at(-1)) === "BUSY"
    ? fauxAssistantMessage(fauxToolCall("delivery_hold", {}), { stopReason: "toolUse" }) : fauxAssistantMessage("DONE")));
  let entered = Promise.withResolvers();
  const hold = defineTool({
    name: "delivery_hold", label: "Hold a real SDK tool until cancellation", description: "Delivery test tool", parameters: Type.Object({}),
    async execute(_id, _params, signal) {
      entered.resolve();
      await new Promise((resolve) => {
        const stopped = () => setTimeout(resolve, 20);
        if (signal?.aborted) stopped();
        else signal?.addEventListener("abort", stopped, { once: true });
      });
      return { content: [{ type: "text", text: "hold interrupted" }], details: {} };
    },
  });
  let host;
  const services = await createAgentSessionServices({
    cwd: root, agentDir: join(root, "reentrant-agent"), modelRuntime,
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
    resourceLoaderOptions: {
      noExtensions: false, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      extensionFactories: [{ name: "delivery-boundary", factory: (pi) => pi.on("turn_end", () => host?.flushPeerInbox()) }],
    },
  });
  const { session } = await createAgentSessionFromServices({
    services, sessionManager: SessionManager.inMemory(root), model: faux.getModel("test"), thinkingLevel: "off",
    tools: [hold.name], customTools: [hold],
  });
  host = createSessionHost({ session });
  const message = (messageId, body) => ({ label: "Sender", sender: "sender-native-id", messageId, replyTo: "", expectReply: false, body });
  let action;
  let reentrant;
  const watcher = host.subscribe((event) => {
    if (!action || event.details?.sdkType !== "queue_update" || !event.details.followUp?.length) return;
    const current = action;
    action = undefined;
    // Pi emits queue_update before pushing into agent-core; cancellation must reclaim once,
    // then clear the late agent-core insertion at settlement without replaying or losing it.
    if (current.kind === "abort") {
      reentrant = Promise.all([
        host.receivePeer({ ...message("reentrant-abort", "REENTRANT_ABORT"), arrival: 999_999 }, "abort"),
        host.receivePeer(message("reentrant-arrival", "REENTRANT_ARRIVAL")),
      ]);
    } else reentrant = host.cancel({ operationId: current.operationId });
  });
  try {
    const run = await host.submit({ requestId: "reentrant-run", message: "BUSY" });
    assert(run.accepted);
    await entered.promise;
    action = { kind: "abort" };
    await host.receivePeer(message("reentrant-follow", "REENTRANT_FOLLOWUP"), "followUp");
    await until(() => reentrant, "reentrant queue_update abort");
    await reentrant;
    await run.completion;
    await until(() => host.isIdle, "reentrant abort settled and new peer turn completed");
    const peers = session.messages.filter((entry) => entry.role === "user").flatMap((entry) => parsePeerMessages(text(entry)) ?? []);
    assert.deepEqual(peers.map(({ body }) => body), ["REENTRANT_FOLLOWUP", "REENTRANT_ABORT", "REENTRANT_ARRIVAL"]);
    assert.deepEqual(peers.map(({ arrival }) => arrival), [1, 2, 3], "recipient overwrites supplied transport order");
    assert(peers.every(({ batch }) => batch?.count === 3), "all pending messages start one new envelope");
    assert.equal(session.pendingMessageCount, 0, "late agent-core insertion is cleared by the SDK's public clearQueue");

    entered = Promise.withResolvers();
    reentrant = undefined;
    const stopped = await host.submit({ requestId: "reentrant-user-stop", message: "BUSY" });
    assert(stopped.accepted);
    await entered.promise;
    action = { kind: "cancel", operationId: stopped.operationId };
    await host.receivePeer(message("reentrant-discard", "USER_STOP_DISCARDS"), "followUp");
    await until(() => reentrant, "reentrant user cancellation");
    await reentrant;
    assert.equal((await stopped.completion).status, "cancelled");
    const next = await host.submit({ requestId: "reentrant-next", message: "Continue without replay" });
    assert(next.accepted);
    await next.completion;
    assert(!session.messages.filter((entry) => entry.role === "user").flatMap((entry) => parsePeerMessages(text(entry)) ?? []).some(({ messageId }) => messageId === "reentrant-discard"));

    entered = Promise.withResolvers();
    const accepting = await host.submit({ requestId: "reentrant-accepting", message: "BUSY" });
    assert(accepting.accepted);
    await entered.promise;
    let interruption;
    const acceptedWatcher = host.subscribe((event) => {
      if (event.type === "request_accepted" && event.details?.queue === "followUp" && !interruption) {
        interruption = host.receivePeer(message("accepted-abort", "ABORT_AT_ACCEPTANCE"), "abort");
      }
    });
    await host.receivePeer(message("accepted-follow", "FOLLOWUP_AT_ACCEPTANCE"), "followUp");
    acceptedWatcher.unsubscribe();
    assert(interruption);
    assert.equal(host.getSnapshot().state, "cancel_requested", "reentrant abort cannot be overwritten by the outer admission's running event");
    await interruption;
    await accepting.completion;
    await until(() => host.isIdle, "acceptance-time interruption and delivery settled");
    const recovered = session.messages.filter((entry) => entry.role === "user").flatMap((entry) => parsePeerMessages(text(entry)) ?? []).filter(({ messageId }) => messageId.startsWith("accepted-"));
    assert.deepEqual(recovered.map(({ body }) => body), ["FOLLOWUP_AT_ACCEPTANCE", "ABORT_AT_ACCEPTANCE"], "input queued after cancellation is reclaimed exactly once at settlement");
  } finally {
    watcher.unsubscribe();
    await host.close();
  }
}

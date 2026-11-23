import assert from "node:assert/strict";
import { join } from "node:path";
import { SessionManager, SettingsManager, createAgentSessionServices, createAgentSessionFromServices } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";
import { createSessionHost } from "../../../src/sessions/host/assemble-host.ts";
import { createAgentMessaging } from "../../../src/sessions/peer-messaging/assemble-peer-messaging.ts";
import { createMessagingTools } from "../../../src/plugins/sessions/tools/create-messaging-tools.ts";
import { DEFAULT_DERIVED_SCHEMAS } from "../../../src/plugins/sessions/default-schema.ts";

export async function checkHandledInput({ modelRuntime, faux, root, home, extensionBehavior, until, text }) {
  let counter = 0;
    // Real SDK sessions and session_send execution; the input handler is an inline SDK factory.
    const handledInputs = [], handledCalls = [];
    const generationGate = { entered: Promise.withResolvers(), release: Promise.withResolvers() };
    const settlementGate = { entered: Promise.withResolvers(), release: Promise.withResolvers() };
    const handledProvider = fauxProvider({ provider: "handled-peer-check", models: [{ id: "root" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(handledProvider.provider);
    handledProvider.setResponses(Array.from({ length: 30 }, () => async (context) => {
      handledCalls.push(context.messages.map(text));
      if (text(context.messages.at(-1)) === "HANDLED-BUSY") {
        generationGate.entered.resolve();
        await generationGate.release.promise;
      }
      return fauxAssistantMessage("Ordinary input completed.");
    }));
    async function inlineSession(model, extensionFactories = [], tools = []) {
      const services = await createAgentSessionServices({
        cwd: root, agentDir: join(home, "agent"), modelRuntime,
        settingsManager: SettingsManager.inMemory({ compaction: { enabled: false }, steeringMode: "all", followUpMode: "all" }),
        resourceLoaderOptions: {
          noExtensions: false, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
          extensionFactories: [...extensionFactories, { name: "sessions", factory: (pi) => { for (const tool of tools) pi.registerTool(tool); } }],
        },
      });
      return (await createAgentSessionFromServices({
        services, sessionManager: SessionManager.inMemory(root), model, thinkingLevel: "off",
        tools: tools.map((tool) => tool.name),
      })).session;
    }
    let handledHost, sendingHost;
    try {
      let holdSettlement = false;
      const handledSession = await inlineSession(handledProvider.getModel("root"), [{ name: "handled-peer-input", factory: (pi) => {
        pi.on("input", (event) => {
          const entries = parsePeerMessages(event.text);
          if (!entries) return { action: "continue" };
          assert.equal(event.source, "extension", "Peer dispatch retains the native extension input source");
          handledInputs.push({ entries, streamingBehavior: event.streamingBehavior });
          return { action: "handled" };
        });
        pi.on("turn_end", () => handledHost?.flushPeerInbox());
        pi.on("before_agent_start", (event) => { holdSettlement = event.messageType === "user" && event.prompt === "HANDLED-FALLBACK"; });
        pi.on("agent_before_settle", async (event) => {
          if (!holdSettlement || event.outcome !== "completed") return;
          holdSettlement = false;
          settlementGate.entered.resolve();
          await settlementGate.release.promise;
        });
      } }]);
      handledHost = createSessionHost({ session: handledSession, sessionOptions: extensionBehavior.session });
      const messaging = createAgentMessaging({
        list: () => [
          { sessionId: sendingHost.getSnapshot().sessionId, label: "Sender", state: sendingHost.getSnapshot().state },
          { sessionId: handledHost.getSnapshot().sessionId, label: "Recipient", state: handledHost.getSnapshot().state },
        ],
        deliver: (_to, entry) => handledHost.receivePeer(entry),
      }, extensionBehavior.session);
      const sendingSession = await inlineSession(faux.getModel("root"), [], createMessagingTools({
        schemas: DEFAULT_DERIVED_SCHEMAS, sessionOptions: extensionBehavior.session,
        list: () => messaging.list().filter((peer) => peer.sessionId !== sendingHost.getSnapshot().sessionId),
        send: (request) => messaging.send(sendingHost.getSnapshot().sessionId, request),
      }));
      sendingHost = createSessionHost({ session: sendingSession });
      async function handledSend(body) {
        const start = sendingSession.messages.length;
        const run = await sendingHost.submit({ requestId: `handled-send-${++counter}`, message: `TOOL ${JSON.stringify({ tool: "session_send", args: { to: handledHost.getSnapshot().sessionId, message: body } })}` });
        assert.equal(run.accepted, true);
        assert.equal((await run.completion).status, "completed");
        const result = sendingSession.messages.slice(start).find((message) => message.role === "toolResult" && message.toolName === "session_send");
        assert.equal(result.isError, false, text(result));
        const receipt = JSON.parse(text(result));
        assert.equal(receipt.accepted, true, "Sender keeps its actual inbox admission receipt");
        return receipt;
      }
      for (const scenario of [
        { mode: "idle", bodies: ["HANDLED-IDLE"] },
        { mode: "steer", prompt: "HANDLED-BUSY", gate: generationGate, bodies: ["HANDLED-BATCH-1", "HANDLED-BATCH-2"] },
        { mode: "fallback", prompt: "HANDLED-FALLBACK", gate: settlementGate, bodies: ["HANDLED-RUN-END"] },
      ]) {
        const start = handledSession.messages.length, inputStart = handledInputs.length;
        const running = scenario.prompt ? await handledHost.submit({ requestId: `handled-run-${++counter}`, message: scenario.prompt }) : null;
        if (running) { assert.equal(running.accepted, true); await scenario.gate.entered.promise; }
        const accepted = [];
        for (const body of scenario.bodies) accepted.push(await handledSend(body));
        if (running) {
          assert.deepEqual(accepted.map((receipt) => receipt.delivery), scenario.bodies.map(() => "queued"));
          scenario.gate.release.resolve();
          assert.equal((await running.completion).status, "completed");
        }
        await until(() => handledHost.isIdle, `handled ${scenario.mode} dispatch settled`);
        const inputs = handledInputs.slice(inputStart);
        assert.equal(inputs.length, 1, "Whole peer batch goes through the input handler once");
        assert.deepEqual(inputs[0].entries.map((entry) => entry.messageId), accepted.map((receipt) => receipt.id));
        assert.equal(inputs[0].streamingBehavior, scenario.mode === "steer" ? "steer" : undefined);
        assert.equal(handledSession.messages.slice(start).filter((message) => message.role === "user" && parsePeerMessages(text(message))).length, 0);
        assert.deepEqual(handledHost.getSnapshot().queuedMessages, { steering: [], followUp: [] });
        assert.equal(handledSession.messages.slice(start).filter((message) => message.customType === "gateway-peer-discard-notice").length, 0, "Notice waits for the next run");
        const beforeNextCalls = handledCalls.length;
        const next = await handledHost.submit({ requestId: `handled-next-${++counter}`, message: `NEXT-AFTER-HANDLED-${scenario.mode}` });
        assert.equal((await next.completion).status, "completed");
        const notice = handledSession.messages.slice(start).filter((message) => message.customType === "gateway-peer-discard-notice");
        assert.equal(notice.length, 1, `Handled ${scenario.mode} input is reported, not silently swallowed`);
        assert.deepEqual(notice[0].details.entries, accepted.map((receipt) => ({ sender: sendingHost.getSnapshot().sessionId, messageId: receipt.id, reason: "handled by an input extension", disposition: "never-delivered" })));
        for (const receipt of accepted) assert.equal(text(notice[0]).split(receipt.id).length - 1, 1, "Notice lists each accepted ID once");
        assert.equal(handledCalls.length, beforeNextCalls + 1, "Notice does not trigger its own provider turn");
        assert(handledCalls.at(-1).some((body) => body.includes("handled by an input extension") && accepted.every((receipt) => body.includes(receipt.id))), "Next provider context sees the discard notice");
        const later = await handledHost.submit({ requestId: `handled-later-${++counter}`, message: "LATER-ORDINARY-INPUT" });
        assert.equal((await later.completion).status, "completed");
        assert.equal(handledSession.messages.slice(start).filter((message) => message.customType === "gateway-peer-discard-notice").length, 1, "Handled notice is not repeated");
      }
      console.log("PASS: handled inline input extension reports idle, merged turn-end steering and run-end fallback peer batches in next-run notices; accepted sends are not silently lost");
    } finally {
      generationGate.release.resolve(); settlementGate.release.resolve();
      await Promise.all([sendingHost?.close(), handledHost?.close()]);
    }
}

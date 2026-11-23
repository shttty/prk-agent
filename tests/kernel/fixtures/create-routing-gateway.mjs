import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { createSessionCollection } from "../../../src/sessions/collection/assemble-collection.ts";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";
import { controlledRunner } from "./start-window-runner.mjs";

export async function createRoutingGateway(home, python, options, { clock, kernelPolicy, runner } = {}) {
  const prkHome = process.env.PRK_HOME;
  const { agentDir } = initializePrkHome(prkHome);
  await mkdir(agentDir, { recursive: true });
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "admission-routing", models: [{ id: "controlled", input: ["text", "image"] }], tokensPerSecond: 100_000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const model = provider.getModel();
  // Select calls by submitted turn, not position in a shared reply queue: finished-cell wakes can also reach Pi.
  provider.setResponses(Array.from({ length: 64 }, () => ({ messages }) => {
    const message = messages.at(-1);
    const body = typeof message?.content === "string" ? message.content : message?.content?.[0]?.text;
    if (message?.role === "user" && body?.startsWith("ROUTING ")) {
      const { id, tool, args } = JSON.parse(body.slice(8));
      return fauxAssistantMessage(fauxToolCall(tool, args, { id }), { stopReason: "toolUse" });
    }
    return fauxAssistantMessage("Observed.");
  }));

  const peer = controlledRunner(runner);
  let kernel, collection;
  const config = parsePrkConfig({
    session: { workerTools: "code", noSkills: true, noExtensions: true, noContextFiles: true, noPromptTemplates: true,
      capabilities: { "kernel:routing_denied": false } },
    kernel: { asyncExecution: true, maxActiveCells: 2, ...kernelPolicy },
    memory: { enabled: false, review: false }, monitor: { enabled: false }, targetCacheRoot: join(home, "cache"),
  });
  const host = await createGatewayHost({ home: prkHome, cwd: home, model: "admission-routing/controlled", config,
    targets: [executionTargetFromConfig({ id: "owned", label: "Owned local target", local: true, cwd: home, python })],
  }, {
    runtimeDependencies: { cwd: home, agentDir, modelRuntime, model, thinkingLevel: "off", autoCompaction: false,
      createKernel: (hooks) => kernel = createPythonTool({ target: "owned", cwd: home, python, acquire: async () => peer.lease,
        processWindow: config.processWindow, memoryMax: "4G", memorySwapMax: "0", scoped: false },
      { ...hooks, clock, runnerMaxActiveCells: 2 }, options) },
    collectionFactory: (targets, setup) => collection = createSessionCollection(targets, setup),
  });
  try {
    await prepareGatewayEnvironment(host, prkHome, "owned");
    const { session: { sessionId } } = await host.createSession({ target: "owned", cwd: home });
    const session = host.session(sessionId);
    let cursor = 0;
    let serial = 0;
    return {
      peer, kernel, session,
      finished: (cell) => collection.get(sessionId).session.sessionManager.getBranch().find((entry) =>
        entry.type === "custom_message" && entry.details?.eventId === `${cell.cellId}:finished`),
      close: () => host.close(),
      result: (cell, imageIndex) => host.kernelResult(sessionId, cell.cellId, imageIndex),
      asks: () => host.state(sessionId).extensionUi.prompts.filter(({ kind }) => kind === "ask"),
      answer: (prompt, selected) => host.nativeAction(sessionId, { sessionId, action: "extension-ui", requestId: `answer-${++serial}`,
        args: { operation: "dialog", clientId: "admission-routing", id: prompt.id, answers: [{ id: prompt.questions[0].id, selected: [selected] }] } }),
      async turn(tool, args) {
        await until(() => session.state === "idle" && session.isIdle && (collection.get(sessionId)?.session.isIdle ?? true), `idle SDK before ${tool}`);
        const id = `routing-${++serial}`;
        const admission = await session.submit({ requestId: id, message: `ROUTING ${JSON.stringify({ id, tool, args })}` });
        assert.equal(admission.accepted, true, JSON.stringify(admission));
        return async () => {
          assert.equal((await admission.completion).status, "completed");
          const projected = session.getSnapshot().messages.findLast((entry) => entry.role === "toolResult" && entry.toolCallId === id);
          assert(projected, `real SDK produced no ${tool} result for ${id}`);
          return projected.outputPreview ? host.toolContent(sessionId, id).result : projected;
        };
      },
      async next(kind, owner) {
        const { frame } = await until(() => peer.frames[cursor], `${kind} from processWrite (frame ${cursor})`);
        cursor++;
        assert.equal(frame.kind, kind, JSON.stringify(frame));
        if (owner) assert.deepEqual([frame.generation, frame.cellId], [owner.generation, owner.cellId], `wrong ${kind} owner`);
        return frame;
      },
      noExtraFrames: () => assert.equal(peer.frames.length, cursor, "unexpected writes, including replies to cancelled or foreign requests"),
    };
  } catch (error) {
    await host.close();
    throw error;
  }
}

export async function until(read, label) {
  const deadline = performance.now() + 10_000;
  for (;;) {
    const value = read();
    if (value) return value;
    assert(performance.now() < deadline, `Timed out waiting for ${label}`);
    await delay(5);
  }
}

export const text = ({ content }) => content.filter(({ type }) => type === "text").map((part) => part.text).join("\n");

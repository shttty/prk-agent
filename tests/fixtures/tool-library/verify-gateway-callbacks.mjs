import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentSystemMessage, getSystemMessageText } from "@earendil-works/pi-ai";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../prepare-gateway-environment.mjs";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../../src/gateway/socket-client/connect-client.ts";
import { readCallableNames } from "../gateway-prompt/read-callable-names.mjs";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { createTargetChannels } from "../../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";

export async function verifyGatewayCallbacks({ modelRuntime, environment, configuration, home, agentDir, onCleanup, text }) {
    const gatewayProvider = fauxProvider({ provider: "gateway-library", tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(gatewayProvider.provider);
    const gatewayConfig = parsePrkConfig({
      session: { workerTools: "code", noExtensions: true, noSkills: true },
      memory: { review: false }, monitor: { enabled: false },
    });
    const targetChannels = createTargetChannels({ options: { ...gatewayConfig.targetConnection, processWindow: configuration.processWindow },
      open: async (_machine, signal) => ({ transport: await openProcessTransport(await environment.acquire(), environment.python, environment.root, signal, gatewayConfig.targetConnection.startTimeoutMs, configuration.processWindow), command: "" }),
    });
    const host = await createGatewayHost({ cwd: home, home, historyDir: join(home, "history"), config: gatewayConfig,
      targets: [executionTargetFromConfig({ id: "library-target", label: "Library target", local: environment.local, sshCommand: environment.sshCommand, python: environment.python, cwd: environment.root })],
      model: `${gatewayProvider.getModel().provider}/${gatewayProvider.getModel().id}` }, {
      runtimeDependencies: { model: gatewayProvider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir, targetChannels,
        createKernel: (hooks) => createPythonTool({ ...configuration, target: "library-target" }, hooks) },
    });
    const socket = join(home, "gateway.sock");
    const server = await startGateway(host, socket);
    onCleanup(() => server.close());
    const client = await connectGateway(socket);
    onCleanup(() => client.disconnect());
    await prepareGatewayEnvironment(host, home, "library-target");
    const createWorker = async () => (await host.createSession({ target: "library-target", cwd: environment.root })).session.sessionId;
    const worker = await createWorker();
    let receivedPrompt;
    const runGateway = async (code, expectedError = false, receiver = worker) => {
      gatewayProvider.setResponses([(context) => {
        receivedPrompt = getSystemMessageText(getCurrentSystemMessage(context.messages));
        return fauxAssistantMessage(fauxToolCall("kernel_code", { code }), { stopReason: "toolUse" });
      }, fauxAssistantMessage("Observed.")]);
      const admission = await host.session(receiver).submit({ requestId: crypto.randomUUID(), message: "Execute the library cell." });
      assert.equal(admission.accepted, true);
      const completion = await admission.completion;
      const snapshot = host.state(receiver);
      const outcome = snapshot.messages.findLast((message) => message.role === "toolResult");
      assert.equal(completion.status, "completed", JSON.stringify({ completion, kernel: snapshot.kernel, outcome }));
      assert.equal(outcome.isError, expectedError, text(outcome));
      return outcome;
    };
    await runGateway("visible = gateway.describe()\nprint('R7_DISCOVERY', visible)\nassert not any(item['name'].startswith('prk_library_') for item in visible)");
    assert(!readCallableNames(receivedPrompt).some((name) => name.startsWith("prk_library_")), "Internal library callbacks are absent from the actual provider prompt catalog");
    await runGateway("@tool(persist=True, reason='Increment counts for recurring batch estimates.')\ndef r7_increment(value):\n    return value + 1\nassert r7_increment(41) == 42\nassert r7_increment(9) == 10");
    let increment = (await client.request("toolsList", {})).tools.find((item) => item.name === "r7_increment");
    assert.equal(increment.successfulCalls, 2);
    assert.equal(increment.distinctSessions, 1);
    assert.equal(increment.status, "staging");
    const internalCalls = [
      ["prk_library_save", { name: "forged", source: "def forged(value):\n    return value + 1", signature: "(value)", docstring: "Hand-built metadata must not be a model save path.", imports: [], reason: "Recurring fixture calculations." }],
      ["prk_library_access", {}],
      ["prk_library_used", { name: "r7_increment", version: 1 }],
      ["prk_library_available", { tools: [] }],
    ];
    for (const [name, args] of internalCalls) {
      await runGateway(`gateway.describe(${JSON.stringify(name)})`, true);
      const payload = JSON.stringify(JSON.stringify(args));
      await runGateway(`import json\ngateway.${name}(**json.loads(${payload}))`, true);
      await runGateway(`import json\ngateway.call(${JSON.stringify(name)}, json.loads(${payload}))`, true);
    }
    assert.equal((await client.request("toolsList", {})).tools.find((item) => item.name === "r7_increment").successfulCalls, 2, "Refused internal calls cannot forge a use");
    assert(!(await client.request("toolsList", {})).tools.some((item) => item.name === "forged"));
    const nextWorker = await createWorker();
    await runGateway("assert r7_increment(99) == 100\nassert any(item['name'] == 'r7_increment' for item in library_sync())\nassert any(item['name'] == 'prk_saved_r7_increment' for item in gateway.describe())\nassert not any(item['name'].startswith('prk_library_') for item in gateway.describe())", false, nextWorker);
    increment = (await client.request("toolsList", {})).tools.find((item) => item.name === "r7_increment");
    assert.equal(increment.successfulCalls, 3, "A fresh native session loads the wrapped tool and accumulates successes");
    assert.equal(increment.distinctSessions, 2);
    assert.equal(increment.status, "staging");
    console.log("R7_PRELUDE_LIBRARY calls=2/sessions=1 then calls=3/sessions=2; discovery and direct internal callback paths refused");
    if (process.env.PI_TEST_TOOL_EVIDENCE) {
      await mkdir(process.env.PI_TEST_TOOL_EVIDENCE, { recursive: true });
      await writeFile(join(process.env.PI_TEST_TOOL_EVIDENCE, "callback-isolation.json"), JSON.stringify({ systemPrompt: receivedPrompt, increment }, null, 2) + "\n");
    }
    await client.request("toolsDelete", { name: "r7_increment" });
    for (const [name, reason] of [["missing_reason", undefined], ["empty_reason", ""], ["blank_reason", " \t\n "]]) {
      const reasonArgument = reason === undefined ? "" : `, reason=${JSON.stringify(reason)}`;
      const refusal = await runGateway(`@tool(persist=True${reasonArgument})\ndef ${name}(value):\n    return value * 3`, true);
      assert.match(text(refusal), /ValueError: Persisted tools require a nonblank reason describing future tasks that will reuse them\./);
      assert(!(await client.request("toolsList", {})).tools.some((item) => item.name === name));
    }
    await runGateway("@tool(persist=True, reason='  Scale integer counts for recurring batch sizing.  ')\ndef triple(value):\n    return value * 3\nassert triple(7) == 21\nassert triple(2) == 6\nassert triple(9) == 27");
    let listed = (await client.request("toolsList", { target: "library-target" })).tools;
    assert.equal(listed.find((item) => item.name === "triple").distinctSessions, 1);
    assert.equal(listed.find((item) => item.name === "triple").successfulCalls, 3);
    assert.equal(listed.find((item) => item.name === "triple").status, "staging");
    assert.equal(listed.find((item) => item.name === "triple").reason, "Scale integer counts for recurring batch sizing.");
    assert.equal(listed.find((item) => item.name === "triple").available, true);
    await runGateway("triple(None)", true);
    assert.equal((await client.request("toolsList", {})).tools.find((item) => item.name === "triple").successfulCalls, 3);
    await runGateway("@tool(persist=True, reason='  Scale integer counts for recurring quarter-unit batches.  ')\ndef triple(value):\n    return value * 4");
    listed = (await client.request("toolsList", { target: "library-target" })).tools;
    assert.equal(listed[0].version, 2);
    assert.equal(listed[0].reason, "Scale integer counts for recurring quarter-unit batches.");
    assert.equal(listed[0].successfulCalls, 3, "same-name replacement preserves cumulative successes");
    assert.equal(listed[0].distinctSessions, 1);
    assert.equal(listed[1].reason, "Scale integer counts for recurring batch sizing.");
    assert.equal(listed[1].successfulCalls, 3);
    await runGateway("assert triple(7) == 28");
    assert.equal((await client.request("toolsList", {})).tools[0].successfulCalls, 4);
    const promoted = (await client.request("toolsPromote", { name: "triple" })).tools[0];
    assert.equal(promoted.status, "promoted");
    assert.equal(promoted.manual, true);
    assert.equal((await client.request("toolsDemote", { name: "triple" })).tools[0].manual, false);
    assert.equal((await client.request("toolsArchive", { name: "triple" })).tools[0].status, "archived");
    await runGateway("library_sync()\nassert 'triple' not in globals()");
    assert.equal((await client.request("toolsRestore", { name: "triple" })).tools[0].status, "staging");
    await runGateway("library_sync()\nassert triple(2) == 8");
    assert.equal((await client.request("toolsList", {})).tools[0].successfulCalls, 5);
    await runGateway("def local_helper():\n    return 41\ntry:\n    @tool(persist=True, reason='Reuse local calculations for recurring numeric analysis.')\n    def bad_global():\n        return local_helper()\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError('non-import global was persisted')");
    assert(!(await client.request("toolsList", {})).tools.some((item) => item.name === "bad_global"));
    assert.deepEqual((await client.request("toolsDelete", { name: "triple" })).tools, []);
    await assert.rejects(client.request("toolsRestore", { name: "triple" }), (error) => error.code === "NOT_FOUND");
}

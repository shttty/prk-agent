import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function checkGatewayMemory({ config, tempRoot, home, options, onCleanup, text }) {
    const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
    const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
    const { createGatewayHost } = await import("../../../src/gateway/host/start-host.ts");
    const { startGateway } = await import("../../../src/gateway/socket-server/start-listener.ts");
    const { connectGateway } = await import("../../../src/gateway/socket-client/connect-client.ts");
    const { parsePrkConfig } = await import("../../../src/config/document/parse-prk-config.ts");
    const { Type } = await import("typebox");
    const { Value } = await import("typebox/value");
    await mkdir(join(home, "agent"), { recursive: true });
    const modelRuntime = await ModelRuntime.create({ authPath: join(home, "agent/auth.json"), modelsPath: null, refreshOnCreate: false });
    const provider = fauxProvider({ tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const gatewayConfig = parsePrkConfig({ kernel: options, session: { workerTools: "direct" } }, { instances: [{ ...config, id: "fixture", label: "Fixture", cwd: tempRoot }] });
    const gateway = await createGatewayHost({ cwd: home, home, config: gatewayConfig, model: `${provider.getModel().provider}/${provider.getModel().id}` }, {
      runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir: join(home, "agent") },
    });
    const socket = join(home, "memory.sock");
    const server = await startGateway(gateway, socket);
    const client = await connectGateway(socket);
    onCleanup(async () => { client.disconnect(); await server.close(); });
    const worker = await gateway.createSession({ target: "fixture" });
    const workerName = worker.session.sessionId;
    for (const method of ["kernelClear", "kernelRestart"]) await assert.rejects(client.request(method, { sessionId: workerName }), (error) => error.code === "UNAVAILABLE");
    let request = 0;
    const runGatewayCell = async (code) => {
      provider.setResponses([fauxAssistantMessage(fauxToolCall("kernel_code", { code }), { stopReason: "toolUse" }), fauxAssistantMessage("Observed memory check.")]);
      const submission = await gateway.session(workerName).submit({ requestId: `memory-${++request}`, message: "Execute the memory check cell." });
      assert.equal(submission.accepted, true);
      return submission;
    };
    let submission = await runGatewayCell("gateway_variable = 42\nprint('gateway initialized')");
    assert.equal((await submission.completion).status, "completed");
    {
      // Idle kernels publish nothing periodically; busy cells still sample every interval.
      const hostKernel = [];
      const lifecycle = [];
      const subscription = gateway.session(workerName).subscribe((event) => { if (event.type === "state_changed" && event.details?.kernel) hostKernel.push(event.details.kernel); });
      const stopCollection = gateway.subscribeSessions((event) => { if (event.type === "session_kernel") lifecycle.push(event.details.kernel); });
      try {
        await new Promise((resolve) => setTimeout(resolve, 20 * options.telemetryIntervalMs));
        assert.equal(hostKernel.length, 0, "idle kernel must not push periodic state_changed");
        assert.equal(lifecycle.length, 0);
        submission = await runGatewayCell("import time\ntime.sleep(1)");
        assert.equal((await submission.completion).status, "completed");
        assert(hostKernel.filter((kernel) => kernel.memory).length >= 5, "busy cell keeps interval telemetry");
        assert(hostKernel.some((kernel) => kernel.namespace), "namespace is carried when it changes");
        assert(hostKernel.filter((kernel) => kernel.namespace).length <= 2, "unchanged namespace must not repeat on every tick");
        assert(lifecycle.length > 0 && lifecycle.length <= 6, `worker_kernel only on lifecycle changes, got ${lifecycle.length}`);
        assert(lifecycle.every((kernel) => kernel.memory === undefined && kernel.namespace === undefined));
        hostKernel.length = 0;
        await new Promise((resolve) => setTimeout(resolve, 20 * options.telemetryIntervalMs));
        assert.equal(hostKernel.length, 0, "idle again after the cell");
      } finally { subscription.unsubscribe(); stopCollection(); }
    }
    const snapshotSchema = Type.Object({ state: Type.Literal("idle"), kernelId: Type.String(), memory: Type.Object({ current: Type.Number(), workingSet: Type.Number(), baseline: Type.Number(), extra: Type.Number(), scope: Type.String(), memoryMax: Type.String(), memorySwapMax: Type.String(), oomKill: Type.Number() }) });
    const gatewayInitial = gateway.state(workerName).kernel;
    const wireClear = await client.request("kernelClear", { sessionId: workerName });
    assert(Value.Check(snapshotSchema, wireClear));
    assert.equal(wireClear.kernelId, gatewayInitial.kernelId);
    assert.equal(wireClear.memory.scope, gatewayInitial.memory.scope);
    submission = await runGatewayCell("assert 'gateway_variable' not in globals()\nassert callable(gateway.call)\nimport time\ntime.sleep(1)");
    for (const method of ["kernelClear", "kernelRestart"]) await assert.rejects(client.request(method, { sessionId: workerName }), (error) => error.code === "BUSY");
    assert.equal((await submission.completion).status, "completed");
    const wireRestart = await client.request("kernelRestart", { sessionId: workerName });
    assert(Value.Check(snapshotSchema, wireRestart));
    assert.notEqual(wireRestart.kernelId, gatewayInitial.kernelId);
    assert.notEqual(wireRestart.memory.scope, gatewayInitial.memory.scope);
    await gateway.closeSession(workerName);
    for (const method of ["kernelClear", "kernelRestart"]) await assert.rejects(client.request(method, { sessionId: workerName }), (error) => error.code === "UNAVAILABLE");
    client.disconnect();
    await server.close();
}

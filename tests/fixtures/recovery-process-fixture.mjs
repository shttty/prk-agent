import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { appendFileSync } from "node:fs";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";

// Test-only controlled provider. Instance configuration arrives via IPC, never a saved config.
process.once("message", async ({ root, historyDir, socket, config, prkConfig, instancesDocument, targetName = "recovery-target", targetCwd = root }) => {
  try {
    const { agentDir } = initializePrkHome(root);
    // IPC supplies the home: static SDK imports would run before it is known.
    const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
    const { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentSystemPrompt } = await import("@earendil-works/pi-ai");
    const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
    const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
    const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
    const modelRuntime = await ModelRuntime.create({ authPath: `${agentDir}/auth.json`, modelsPath: null, refreshOnCreate: false });
    const faux = fauxProvider({ provider: "recovery-controlled", models: [{ id: "local" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(faux.provider);
    const respond = async (context) => {
      appendFileSync(`${root}/provider-calls`, "call\n");
      const message = [...context.messages].reverse().find((entry) => entry.role === "user");
      const text = typeof message?.content === "string" ? message.content : (message?.content ?? []).map((part) => part.text ?? "").join("");
      const request = JSON.parse(text);
      if (context.messages.at(-1)?.role === "toolResult") {
        if (request.hold) {
          process.send({ type: "side-effect-finished" });
          return new Promise(() => {}); // OS crash leaves operation genuinely unfinished.
        }
        return fauxAssistantMessage("Controlled Python finished.");
      }
      process.send({ type: "model-context", context: { systemPrompt: getCurrentSystemPrompt(context.messages), messages: context.messages } });
      return fauxAssistantMessage(fauxToolCall("kernel_code", { code: request.code }), { stopReason: "toolUse" });
    };
    faux.setResponses(Array.from({ length: 100 }, () => respond));
    const options = parsePrkConfig(prkConfig ?? { session: { workerTools: "direct" } }, instancesDocument);
    let host;
    const environments = createTargetEnvironments({ resolve: (id) => {
      const target = host.getTarget(id);
      return target.local ? { local: true } : { local: false, command: target.sshCommand };
    } });
    const targetEnvironments = { acquire: (id) => {
      appendFileSync(`${root}/target-acquires`, `${id}\n`);
      return environments.acquire(id);
    } };
    host = await createGatewayHost({ cwd: root, home: root, config: options, historyDir, model: "recovery-controlled/local", targets: instancesDocument ? undefined : [executionTargetFromConfig({ ...config, id: targetName, label: "Recovery instance", tags: [], cwd: targetCwd })] }, {
      runtimeDependencies: { model: faux.getModel(), modelRuntime, thinkingLevel: instancesDocument ? "off" : "low", cwd: root, agentDir, targetEnvironments },
    });
    const endpoint = await startGateway(host, socket, options.gateway, options.limits);
    process.send({ type: "ready" });
    await endpoint.closed;
    process.disconnect();
  } catch (error) {
    process.send?.({ type: "failure", message: error.message });
    process.exitCode = 1;
    process.disconnect();
  }
});

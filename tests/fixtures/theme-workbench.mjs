import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "./prepare-gateway-environment.mjs";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { withTargetFixture } from "./target-fixture.mjs";
import { startWebDev } from "./web-dev.mjs";

export async function withThemeWorkbench(run) {
  const root = await mkdtemp(join(tmpdir(), "prk-themes-"));
  try {
    await withTargetFixture(async ({ config, onCleanup }) => {
      const { agentDir } = initializePrkHome(root);
      const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
      const provider = fauxProvider({ provider: "themes", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
      runtime.registerNativeProvider(provider.provider);
      provider.setResponses([
        fauxAssistantMessage(fauxToolCall("kernel_code", { code: `${Array.from({ length: 45 }, (_, i) => `# theme sample ${i}`).join("\n")}\nif True:\n    print(42)` }), { stopReason: "toolUse" }),
        fauxAssistantMessage("Theme fixture complete."),
      ]);
      const host = await createGatewayHost({ cwd: root, home: root, model: "themes/controlled", config: parsePrkConfig({ memory: { review: false }, session: { idleTimeoutMs: 600000 } }), targets: [
        executionTargetFromConfig({ ...config, id: "fixture", label: "Theme fixture", local: true, tags: [], cwd: root }),
      ] }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
      const gateway = await startGateway(host, join(root, "gateway.sock"));
      onCleanup(() => gateway.close());
      const web = await startWebApplication({ socket: join(root, "gateway.sock"), host: "127.0.0.1", port: 0 });
      onCleanup(() => web.close());
      const ui = await startWebDev(web.server.url);
      onCleanup(() => ui.close());
      await prepareGatewayEnvironment(host, root, "fixture");
      const worker = (await host.createSession({ target: "fixture", label: "Theme fixture" })).session.sessionId;
      await run({ root, host, sessionId: worker, url: ui.url, apiUrl: web.server.url, onCleanup });
    }, { allowHidden: true });
  } finally { await rm(root, { recursive: true, force: true }); }
}

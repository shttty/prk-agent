import { stringify } from "smol-toml";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { withTargetFixture } from "./target-fixture.mjs";
import { prepareGatewayEnvironment } from "./prepare-gateway-environment.mjs";
import { startWebDev } from "./web-dev.mjs";

/** No API mocks: owned Jupyter → target terminal → Gateway → HTTP → Vite. No model requests. */
export async function withMonitorHistoryFixture(run) {
  await withTargetFixture(async ({ config: connection, tempRoot }) => {
    const home = await mkdtemp(join(tmpdir(), "prk-monitor-web-"));
    let host, gateway, client, web, ui;
    try {
      const { agentDir } = initializePrkHome(home);
      await mkdir(agentDir, { recursive: true });
      const counter = join(tempRoot, "custom-counter");
      const document = { monitor: { historyWindowMs: 60000, fastIntervalMs: 500, slowIntervalMs: 60000, focusLeaseMs: 3000, customTimeoutMs: 700 },
        session: { noExtensions: true, idleTimeoutMs: 60000 }, memory: { review: false } };
      const instances = { instances: [{ id: "fixture", label: "Monitor history", ...connection, cwd: tempRoot, customMetrics: [
        { name: "temperature", command: `printf x >> '${counter}'; python3 -c 'import time; print(round(42 + time.time() % 10 / 2, 2))'`, interval_s: 0.5, parse: "number", unit: "°C", chart: "line" },
        { name: "queue", command: `printf '{"queue":{"pending":7}}'`, interval_s: 0.5, parse: "json:queue.pending", unit: "jobs" },
        { name: "invalid", command: "printf unavailable", interval_s: 2, parse: "number" },
      ] }] };
      await writeFile(join(home, "config.toml"), stringify(document));
      await writeFile(join(home, "instances.toml"), stringify(instances), { mode: 0o600 });
      const config = parsePrkConfig(document, instances);
      const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
      const provider = fauxProvider({ provider: "monitor-web", models: [{ id: "controlled" }] });
      modelRuntime.registerNativeProvider(provider.provider);
      host = await createGatewayHost({ home, cwd: home, config, historyDir: join(home, "history"), model: "monitor-web/controlled" },
        { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir } });
      const socket = join(home, "g.sock");
      gateway = await startGateway(host, socket);
      client = await connectGateway(socket);
      await prepareGatewayEnvironment(host, home, "fixture");
      const first = (await client.request("createSession", { target: "fixture", label: "First monitor" })).session.sessionId;
      const second = (await client.request("createSession", { target: "fixture", label: "Shared monitor" })).session.sessionId;
      web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
      ui = await startWebDev(web.server.url);
      await run({ host, client, web, ui, provider, first, second, counter, home, document, instances });
    } finally {
      await ui?.close();
      await web?.close();
      await client?.disconnect();
      if (gateway) await gateway.close(); else await host?.close();
      await rm(home, { recursive: true, force: true });
    }
  }, { allowHidden: true });
}

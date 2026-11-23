import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export async function createWorkspaceOwner({ root, owners, target, deadline, socket, prkConfig, instancesDocument, options, connectGateway, connectWebGateway, startWebServer }) {

    const child = spawn(process.execPath, [fileURLToPath(new URL("../../fixtures/recovery-process-fixture.mjs", import.meta.url))], {
      env: { ...process.env, HOME: root, XDG_CONFIG_HOME: join(root, "config"), XDG_CACHE_HOME: join(root, "cache"), XDG_DATA_HOME: join(root, "data") },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    const exit = once(child, "exit");
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const ready = once(child, "message");
    let connection;
    const processOwner = {
      async stop(crash = false) {
        try {
          if (child.exitCode === null && child.signalCode === null) {
            if (crash || !connection) child.kill("SIGKILL");
            else await deadline(connection.request("shutdown"), "Gateway shutdown response");
            const [code, signal] = await deadline(exit, "Gateway process exit");
            if (crash) assert.equal(signal, "SIGKILL");
            else if (connection) assert.equal(code, 0, stderr.replaceAll(target.token, "<REDACTED>"));
          }
        } finally {
          connection?.disconnect();
          if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL"); await exit;
          }
        }
      },
    };
    owners.push(processOwner);
    child.send({ root, historyDir: join(root, "history"), socket, prkConfig, instancesDocument });
    const [message] = await deadline(ready, "Gateway startup");
    assert.equal(message.type, "ready", `${JSON.stringify(message)} ${stderr}`.replaceAll(target.token, "<REDACTED>"));
    connection = await connectGateway(socket, options.gateway, options.limits);
    const owner = processOwner;
    const client = connection;
    const adapter = await connectWebGateway({ socket, gateway: options.gateway, http: options.http, limits: options.limits });
    const web = await startWebServer(adapter, { port: 0, http: options.http, limits: options.limits });
return { owner, client, adapter, web };
}

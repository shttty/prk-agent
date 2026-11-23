import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectGateway } from "../../../src/gateway/socket-client/connect-client.ts";
import { startWebApplication } from "../../../src/http/application/start-application.ts";

export async function withIsolationGateway({ root, config, cwd, directory, evidence, name, onCleanup }, run) {
  const socket = join(root, "g.sock");
  const prkConfig = { session: { noExtensions: true, workerTools: "direct", idleTimeoutMs: 60000 }, memory: { review: false } };
  const instancesDocument = { instances: [{ id: "fixture", label: "Isolation instance", ...config, cwd }] };
  await writeFile(join(root, "config.toml"), stringify(prkConfig));
  await writeFile(join(root, "instances.toml"), stringify(instancesDocument), { mode: 0o600 });
  const child = fork(fileURLToPath(new URL("../recovery-process-fixture.mjs", import.meta.url)), [], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    env: { ...process.env, PRK_HOME: root, PI_OFFLINE: "1" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let stdout = "", stderr = "", client, web, stopping;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const closed = new Promise((resolveClosed) => child.once("close", (code, signal) => resolveClosed({ code, signal })));
  const stop = () => stopping ??= (async () => {
    let timer;
    try {
      await web?.close();
      if (client && child.exitCode === null && child.signalCode === null) await client.request("shutdown");
    } finally {
      client?.disconnect();
      if (!client && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      try {
        const graceful = await Promise.race([closed, new Promise((resolveTimeout) => { timer = setTimeout(() => resolveTimeout(undefined), 10000); })]);
        if (!graceful) { child.kill("SIGKILL"); await closed; }
      } finally {
        clearTimeout(timer);
        await mkdir(evidence, { recursive: true });
        await writeFile(join(evidence, `${name}.stderr.log`), stderr);
        await writeFile(join(evidence, `${name}.stdout.log`), stdout);
      }
    }
  })();
  onCleanup(stop);
  try {
    const ready = once(child, "message", { signal: AbortSignal.timeout(60000) });
    child.send({ root, historyDir: directory, socket, config, prkConfig, instancesDocument });
    const [message] = await Promise.race([ready, closed.then(({ code, signal }) => { throw new Error(`Gateway exited before readiness (${code}/${signal}): ${stderr}`); })]);
    assert.equal(message.type, "ready", `Gateway startup failed: ${JSON.stringify(message)} ${stderr}`);
    client = await connectGateway(socket);
    web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
    const result = await run({ apiUrl: web.server.url, client });
    await stop();
    assert.deepEqual(await closed, { code: 0, signal: null }, `Gateway exits cleanly: ${stderr}`);
    return { result, stderr };
  } finally {
    await stop();
  }
}

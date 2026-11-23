import { spawn } from "node:child_process";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { connectGateway } from "../../../src/gateway/socket-client/connect-client.ts";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";

export async function launchStreamGateway({ name, prepareArtifacts, repo, home, socket, root, stageFile, answerFile, logs, until, record, setChild, setClient }) {
  await mkdir(join(root, "user"), { recursive: true });
  const processHandle = spawn(process.execPath, [join(repo, "src/main.ts"), "gateway", "--home", home, "--socket", socket, "--model", "session-stream-check/controlled", "--no-skills", "--extension", join(repo, "tests/fixtures/session-stream-state.mjs")], {
    cwd: root, env: { ...process.env, HOME: join(root, "user"), PRK_HOME: home, PRK_STREAM_STAGE_FILE: stageFile, PRK_STREAM_ANSWER_FILE: answerFile, SHELL: "/bin/bash" }, stdio: ["ignore", "pipe", "pipe"],
  });
  const done = new Promise((done, reject) => { processHandle.once("error", reject); processHandle.once("exit", (code, signal) => done({ code, signal })); });
  setChild({ process: processHandle, done });
  processHandle.stdout.on("data", (chunk) => logs.push(`${name}:stdout:${chunk}`));
  processHandle.stderr.on("data", (chunk) => logs.push(`${name}:stderr:${chunk}`));
  const client = await until(async () => {
    if (processHandle.exitCode !== null || processHandle.signalCode !== null) throw new Error(`Gateway exited during startup: ${logs.join("")}`);
    try { const next = await connectGateway(socket); await next.request("workbench", {}); return next; } catch { return null; }
  }, Boolean, "Gateway socket ready");
  setClient(client);
  const environment = await prepareGatewayEnvironment(client, home, "stream", { prepareArtifacts });
  record.processes.push({ stage: name, pid: processHandle.pid, environment });
  return processHandle.pid;
}
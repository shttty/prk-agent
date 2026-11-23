// Explicit test extension: observe public SDK lookups inside the real Gateway.
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

export default function register() {
  const child = spawnSync(process.execPath, ["--input-type=module", "--eval", "process.stdout.write(JSON.stringify({ agentDir: process.env.PRK_CODING_AGENT_DIR, piAgentDir: process.env.PI_CODING_AGENT_DIR, pid: process.pid }))"], {
    encoding: "utf8", timeout: 5000, killSignal: "SIGKILL", maxBuffer: 4096,
  });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`SDK home probe child failed: ${child.status}/${child.signal}`);
  writeFileSync(process.env.PRK_SDK_HOME_PROBE_PATH, JSON.stringify({
    sdkAgentDir: getAgentDir(), configDirName: CONFIG_DIR_NAME, envAgentDir: process.env.PRK_CODING_AGENT_DIR,
    gatewayPid: process.pid, child: JSON.parse(child.stdout),
  }), { mode: 0o600 });
}

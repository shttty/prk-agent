import { existsSync } from "node:fs";
import { join } from "node:path";

/** Pi reads packages and session settings only from agent/settings.json; without it every session starts with neither. */
export function warnMissingAgentSettings(agentDir: string): void {
  const path = join(agentDir, "settings.json");
  if (existsSync(path)) return;
  const migrated = existsSync(join(agentDir, "config.yml"))
    ? " A config.yml is present: an OMP run with PI_CODING_AGENT_DIR pointing here migrates settings.json to it."
    : "";
  console.error(`[${new Date().toISOString()}] Warning: ${path} does not exist; sessions start without packages or agent settings.${migrated}`);
}

import { prkPaths } from "./resolve-prk-paths.ts";
import { resolvePrkHome } from "./resolve-prk-home.ts";

/** Bind SDK/global extension lookups to the selected PRK home, never inherited Pi settings. */
export function initializePrkHome(explicitHome?: string) {
  const paths = prkPaths(resolvePrkHome(explicitHome));
  // The rebranded SDK reads PRK_CODING_AGENT_DIR; PI_CODING_AGENT_DIR is kept for owned child processes
  // (e.g. a stock `pi` CLI run from a session) so they also land in the PRK agent dir.
  process.env.PRK_CODING_AGENT_DIR = paths.agentDir;
  process.env.PI_CODING_AGENT_DIR = paths.agentDir;
  return paths;
}

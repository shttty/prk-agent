import { detectTarget } from "./detect-target.mjs";
import { deployDaemon } from "./deploy-daemon.mjs";
import { observeMarker } from "./observe-marker.mjs";
import { quoteShell } from "./quote-shell.mjs";
import { writeInput } from "./write-input.mjs";

export async function bootstrapLogin(child, token, report, targetCacheRoot) {
  const target = await detectTarget(child, report);
  const daemon = await deployDaemon(child, target, report, targetCacheRoot);
  const ready = observeMarker(child.stdout, Buffer.from(`PI-ENV ${token}\n`), 8000, "exec-token");
  await writeInput(child.stdin, `exec ${quoteShell(daemon)} serve --token ${quoteShell(token)}\n`);
  await ready;
}

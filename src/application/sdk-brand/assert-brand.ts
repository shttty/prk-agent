import { WireError } from "../../gateway/wire/create-error.ts";

/**
 * The SDK is rebranded by scripts/patch-pi.mjs (postinstall); refuse to run as plain `.pi` if it was skipped.
 * Imported dynamically so the SDK loads only after initializePrkHome() has set the agent-dir environment.
 */
export async function assertPrkBrand(): Promise<void> {
  const { CONFIG_DIR_NAME } = await import("@earendil-works/pi-coding-agent");
  if (CONFIG_DIR_NAME !== ".prk") {
    throw new WireError("CLI_ERROR", `Pi SDK is not rebranded (project dir "${CONFIG_DIR_NAME}", expected ".prk"); run: node scripts/patch-pi.mjs`);
  }
}

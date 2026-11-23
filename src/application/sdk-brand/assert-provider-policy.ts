import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WireError } from "../../gateway/wire/create-error.ts";

/** Exercise the approved loader seam before the Gateway can load configured packages. */
export async function assertProviderPolicy(): Promise<void> {
  // SDK configuration is read at import time; initializePrkHome must bind the selected home first.
  const { DefaultResourceLoader, SettingsManager, VERSION } = await import("@earendil-works/pi-coding-agent");
  const cwd = await mkdtemp(join(tmpdir(), "prk-policy-"));
  try {
    if (VERSION !== "1.6.0") throw new Error("unsupported Pi version");
    const loader = new DefaultResourceLoader({
      cwd, agentDir: cwd, settingsManager: SettingsManager.inMemory({}),
      noExtensions: true, noContextFiles: true, noSkills: true, noThemes: true, noPromptTemplates: true,
      providerPolicy: () => "PRK provider policy startup probe",
      extensionFactories: [(pi) => {
        pi.registerProvider("prk-policy-probe", { baseUrl: "http://127.0.0.1:1", api: "openai-responses", models: [] });
        pi.unregisterProvider("prk-policy-probe");
        pi.registerCommand("prk-policy-probe", { handler: async () => {} });
      }],
    });
    await loader.reload();
    const result = loader.getExtensions();
    if (result.errors.length !== 2 || result.errors.some((error) => error.code !== "PROVIDER_POLICY")
      || result.runtime.pendingProviderRegistrations.length !== 0 || !result.extensions[0]?.commands.has("prk-policy-probe")) {
      throw new Error("provider policy did not preserve the extension and reject provider changes");
    }
    const providersOnly = new DefaultResourceLoader({
      cwd, agentDir: cwd, settingsManager: SettingsManager.inMemory({}), providerOnly: true,
      noExtensions: true, noContextFiles: true, noSkills: true, noThemes: true, noPromptTemplates: true,
      extensionFactories: [(pi) => pi.registerCommand("discard", { handler: async () => {} })],
    });
    await providersOnly.reload();
    if (providersOnly.getExtensions().extensions.length) throw new Error("provider-only loading retained a non-provider");
  } catch (error) {
    throw new WireError("CLI_ERROR", `Pi 1.6.0 provider policy patch is missing or ineffective; run: node scripts/patch-pi.mjs (${error instanceof Error ? error.message : String(error)})`);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

import { registrationApi } from "./create-registration-api.mjs";
import { rejectPackage } from "./reject-package.mjs";
import { join } from "node:path";
import { unsupported } from "../../sdk-facade/reject-capability.mjs";
import { readableActions } from "../../sdk-context/create-context.mjs";
import { refreshTools } from "../../registration/refresh-tools.mjs";
import { withLock } from "./read-project-settings.mjs";
import { unavailable } from "./create-unavailable-project-facade.mjs";
import { applyProviderPolicy } from "../../registration/apply-provider-policy.mjs";

export async function loadProjectExtensions(ctx, owner, sdk, paths) {
  const packages = paths.map((path) => {
    const pkg = { name: `Project extension: ${path}`, path, index: owner.packages.length, tools: [], handlers: [], commands: [] };
    owner.packages.push(pkg);
    return pkg;
  });
  if (!packages.length) return;
  try {
    if (!owner.snapshot.projectTrusted) throw new Error("Project is not trusted; project extensions were not loaded.");
    const providerPolicyProbe = () => false;
    const runtimeProbe = typeof sdk.createExtensionRuntime === "function"
      ? sdk.createExtensionRuntime({ providerPolicy: providerPolicyProbe, providerOnly: true }) : undefined;
    if (runtimeProbe?.providerPolicy !== providerPolicyProbe || runtimeProbe.providerOnly !== true ||
        !Array.isArray(runtimeProbe.providerPolicyErrors)) {
      throw new Error("Remote project extensions require the PRK Pi 1.6.0 provider-policy patch; rebuild the remote extension bundle with the current Gateway before loading project extensions.");
    }
    // Explicit-only loading avoids executing anything outside the target's discovered entries.
    // The project settings snapshot supplies Pi's own project source metadata instead of CLI scope.
    const projectSettings = JSON.stringify({ extensions: paths });
    const settingsManager = sdk.SettingsManager.fromStorage({
      withLock: withLock.bind(undefined, ctx, projectSettings),
    }, { projectTrusted: owner.snapshot.projectTrusted });
    const loader = new sdk.DefaultResourceLoader({
      cwd: owner.snapshot.cwd, agentDir: join(ctx.sourceDirectory, ".project-agent"),
      settingsManager, eventBus: owner.events, noExtensions: true, additionalExtensionPaths: paths,
      noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      systemPrompt: "", appendSystemPrompt: [],
      providerPolicy: ({ providerId, operation, extensionPath }) => {
        const pkg = packages.find((entry) => entry.path === extensionPath);
        if (!pkg) throw new Error(`Unknown project provider policy source: ${extensionPath}`);
        return applyProviderPolicy(ctx, owner, pkg, extensionPath, operation, providerId);
      },
    });
    await loader.reload();
    if (owner.phase !== "loading") throw new Error("Remote extension load was cancelled");
    const result = loader.getExtensions();
    const errors = new Map(result.errors.map(({ path, error }) => [path, error]));

    // Bind only the remote host's existing readable actions through Pi's public runner API.
    // The runner uses the Gateway-backed session view; it never creates a target SDK session.
    const runner = owner.projectRunner = new sdk.ExtensionRunner(
      result.extensions, result.runtime, owner.snapshot.cwd, owner.sessionManager, ctx.facade(owner, "modelRegistry", {}),
    );
    runner.onError(({ extensionPath, error }) => errors.set(extensionPath, error));
    const actions = readableActions(ctx, owner);
    runner.bindCore(unavailable(ctx, "pi", {
      getSessionName: actions.getSessionName,
      getActiveTools: actions.getActiveTools,
      getThinkingLevel: actions.getThinkingLevel,
      refreshTools: refreshTools.bind(undefined, ctx, owner),
    }), unavailable(ctx, "ctx"), unavailable(ctx, "pi"));
    for (const pkg of packages) {
      try {
        const error = errors.get(pkg.path);
        if (error) throw new Error(error);
        const extension = result.extensions.find((entry) => entry.path === pkg.path);
        if (!extension) throw new Error(`Pi did not load the project extension: ${pkg.path}`);
        pkg.sourceInfo = extension.sourceInfo;
        if (extension.flags.size) unsupported("pi.registerFlag");
        if (extension.shortcuts.size) unsupported("pi.registerShortcut");
        if (result.runtime.mcpServers.list().some((entry) => entry.extensionPath === pkg.path)) unsupported("pi.registerMcpServer");
        const api = registrationApi(ctx, owner, pkg);
        for (const { definition } of extension.tools.values()) api.registerTool(definition);
        for (const [event, handlers] of extension.handlers) for (const handler of handlers) api.on(event, handler);
        for (const { name, ...command } of extension.commands.values()) api.registerCommand(name, command);
      } catch (error) { rejectPackage(ctx, owner, pkg, error); }
    }
  } catch (error) {
    for (const pkg of packages) rejectPackage(ctx, owner, pkg, error);
  }
}

import type { NativeCommand, NativeResource, NativeTarget } from "../native-types.ts";
import { sourceLabel } from "./describe-source.ts";
import { readProviderErrors } from "../../model-providers/read-provider-errors.ts";

export function dynamicResources(target: NativeTarget): { commands: NativeCommand[]; resources: NativeResource[]; diagnostics: string[] } {
  const commands: NativeCommand[] = [];
  const resources: NativeResource[] = [];
  const diagnostics: string[] = [];
  if (!target.session) return {
    commands,
    resources: (["extension", "skill", "template"] as const).map((type) => ({ type, name: `${type}s`, loaded: false, disabled: true, reason: "Dynamic SDK resources are unavailable for read-only history." })),
    diagnostics: ["Dynamic SDK resources are unavailable for read-only history."],
  };
  const loader = target.session.resourceLoader;
  try {
    const extensions = loader.getExtensions();
    for (const extension of extensions.extensions) {
      const source = sourceLabel(extension.sourceInfo);
      const identity = extension.sourceInfo.origin === "package" ? extension.sourceInfo.source : extension.path;
      const providers: string[] = [];
      for (const [providerId, owner] of target.modelProviders?.owners ?? []) {
        if (owner.source === identity || owner.extensionPath === extension.path || owner.extensionPath === extension.resolvedPath) providers.push(providerId);
      }
      resources.push({ type: "extension", name: extension.path, ...(source === undefined ? {} : { source }), loaded: true,
        ...(providers.length ? { providers } : {}) });
    }
    for (const extensionCommand of target.session.extensionRunner.getRegisteredCommands()) {
      commands.push({
        name: extensionCommand.invocationName,
        description: extensionCommand.description ?? `Extension command /${extensionCommand.invocationName}.`,
        source: "extension",
        availability: { enabled: true },
        effect: "context",
        risk: "model",
      });
    }
    for (const diagnostic of target.session.extensionRunner.getCommandDiagnostics()) diagnostics.push(`command resource: ${diagnostic.message}`);
    for (const error of extensions.errors.filter((error) => error.code !== "PROVIDER_POLICY")) {
      resources.push({ type: "extension", name: error.path, source: error.path, loaded: false, disabled: true, reason: error.error });
      diagnostics.push(`Extension ${error.path}: ${error.error}`);
    }
    for (const error of readProviderErrors(extensions.errors, target.capabilityCatalog?.().providerErrors ?? target.modelProviders?.errors)) {
      const loaded = extensions.extensions.some((extension) => extension.path === error.path || extension.resolvedPath === error.path);
      resources.push({ type: "extension", name: error.path, source: error.source ?? error.path, loaded,
        code: error.code, providerId: error.providerId, operation: error.operation, reason: error.error });
      diagnostics.push(`Extension ${error.path} [${error.code}]: ${error.error}`);
    }
  } catch (error) {
    diagnostics.push(`Extension catalog unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const skills = loader.getSkills();
  const skillsEnabled = target.session.settingsManager.getEnableSkillCommands();
  for (const item of skills.skills) {
    const source = sourceLabel(item.sourceInfo);
    resources.push({ type: "skill", name: `/skill:${item.name}`, ...(source === undefined ? {} : { source }), loaded: true, ...(!skillsEnabled ? { disabled: true, reason: "SDK skill commands are disabled in session settings." } : {}) });
    commands.push({ name: `skill:${item.name}`, description: item.description, source: "skill", availability: !skillsEnabled ? { enabled: false, reason: "SDK skill commands are disabled in session settings." } : { enabled: true }, effect: "context", risk: "model" });
  }
  for (const diagnostic of skills.diagnostics) diagnostics.push(`skill resource: ${diagnostic.message}`);
  const prompts = loader.getPrompts();
  for (const item of prompts.prompts) {
    const source = sourceLabel(item.sourceInfo);
    resources.push({ type: "template", name: `/${item.name}`, ...(source === undefined ? {} : { source }), loaded: true });
    commands.push({ name: item.name, description: item.description, source: "template", availability: { enabled: true }, effect: "context", risk: "model" });
  }
  for (const type of ["extension", "skill", "template"] as const) {
    if (!resources.some((resource) => resource.type === type)) resources.push({ type, name: `${type}s`, loaded: false, disabled: true, reason: `No ${type} resources are loaded; the current Gateway resource policy keeps this class disabled.` });
  }
  return { commands, resources, diagnostics };
}

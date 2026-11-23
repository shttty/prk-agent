import { isLibraryCallback } from "../../codemode/kernel-protocol/is-library-callback.ts";
import type { KernelHelper } from "../../codemode/module-catalog/catalog-types.ts";
import type { CapabilityCatalog } from "../../config/capabilities/capability-types.ts";
import { agentsSkillAllowed } from "../resource-catalog/is-agents-skill-allowed.ts";
import { projectCapabilities } from "../resource-catalog/format-capabilities.ts";
import { skillOrigin } from "../resource-catalog/classify-skill-origin.ts";
import { toolOrigin } from "../resource-catalog/classify-tool-origin.ts";
import type { CatalogContext, CollectedCatalogMetadata } from "./catalog-types.ts";
import { META_TOOL_NAMES } from "../tool-declarations/meta-tool-names.ts";
import { readProviderErrors } from "../model-providers/read-provider-errors.ts";

export function formatCatalog(ctx: CatalogContext, { saved, sharedSkills, sharedPaths, skills, tools }: CollectedCatalogMetadata, helpers: KernelHelper[]): CapabilityCatalog {
  const input = ctx.input;
  const catalog = projectCapabilities([
    ...[...tools.values()].filter((tool) => !isLibraryCallback(tool.name) && !Object.hasOwn(META_TOOL_NAMES, tool.name)).map((tool) => ({
      id: `tool:${tool.name}`, kind: "tool" as const, name: tool.name, description: tool.description, exposure: tool.exposure,
      ...(ctx.remoteLoad?.origin(tool) ?? toolOrigin(tool, ctx.nativeNames)),
      ...(tool.name === "kernel_code" && input.config.session.workerTools === "code" ? { locked: true } : {}),
      ...(tool.name.startsWith("prk_saved_") ? { library: saved.find((entry) => `prk_saved_${entry.name}` === tool.name) } : {}),
    })),
    ...helpers.map((helper) => ({
      id: `kernel:${helper.name}`, kind: "tool" as const, name: helper.name,
      description: `${helper.name}${helper.signature}\n${helper.description}`,
      group: "group:tools:kernel", groupLabel: "kernel 函数", source: helper.source ?? "PRK kernel prelude",
      available: helper.available, module: helper.module, error: helper.error,
      overridesBuiltin: helper.overridesBuiltin, dependencies: helper.dependencies,
      moduleOnly: helper.moduleOnly, pending: helper.pending,
    })),
    ...skills.skills.filter(agentsSkillAllowed).map((skill) => ({
      id: `skill:${skill.filePath}`, kind: "skill" as const, name: skill.name, description: skill.description,
      ...skillOrigin(skill, input.skillLibrary.directory, input.agentDir),
      ...(sharedPaths.has(skill.filePath) ? { library: sharedSkills.find((entry) => entry.name === skill.name) } : {}),
    })),
  ], { capabilities: input.config.session.capabilities, localTools: input.config.session.localTools }, {}, undefined, true, [], [input.config.session.capabilities]);
  return { ...catalog, get providerErrors() { return readProviderErrors(ctx.providerErrors ?? [], ctx.remoteLoad?.providerErrors); } };
}

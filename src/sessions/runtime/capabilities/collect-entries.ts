import type { Skill } from "@earendil-works/pi-coding-agent";
import { isLibraryCallback } from "../../../codemode/kernel-protocol/is-library-callback.ts";
import { toolSource } from "./classify-tool.ts";
import { origin } from "../resources/skills/classify-skill.ts";
import { allSkills } from "../resources/skills/list-skills.ts";
import type { CapabilityMetadata } from "../runtime-types.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { META_TOOL_NAMES } from "../../tool-declarations/meta-tool-names.ts";

export function actualCapabilityEntries(ctx: RuntimeContext, skillInventory: Skill[] = allSkills(ctx)) {
    const saved = ctx.dependencies.toolLibrary?.list(ctx.target.id) ?? [];
    const skills = ctx.dependencies.skillLibrary?.list() ?? [];
    const files = ctx.helpers.find((helper) => helper.module === "files");
    const helpers = files && !ctx.helpers.some((helper) => helper.name === "module:files")
      ? [...ctx.helpers, { ...files, name: "module:files", signature: "", description: "PRK file module", moduleOnly: true }]
      : ctx.helpers;
    const entries: CapabilityMetadata[] = [
      ...[...new Map([...ctx.toolInventory, ...(ctx.callbackSession?.getAllTools() ?? [])].map((tool) => [tool.name, tool])).values()].filter((tool) => !isLibraryCallback(tool.name) && !Object.hasOwn(META_TOOL_NAMES, tool.name)).map((tool) => ({
        id: `tool:${tool.name}`, kind: "tool" as const, name: tool.name, description: tool.description, exposure: tool.exposure,
        ...toolSource(ctx, tool), ...(tool.name === "kernel_code" && ctx.toolMode === "code" ? { locked: true } : {}),
        ...(tool.name.startsWith("prk_saved_") ? { library: saved.find((entry) => `prk_saved_${entry.name}` === tool.name) } : {}),
      })),
      ...helpers.map((helper) => ({ id: `kernel:${helper.name}`, kind: "tool" as const, name: helper.name,
        description: `${helper.name}${helper.signature}\n${helper.description}`, group: "group:tools:kernel", groupLabel: "kernel 函数", source: helper.source ?? "PRK kernel prelude",
        available: helper.available, module: helper.module, error: helper.error, overridesBuiltin: helper.overridesBuiltin, dependencies: helper.dependencies,
        moduleOnly: helper.moduleOnly, pending: helper.pending })),
      ...skillInventory.map((skill) => ({
        id: `skill:${skill.filePath}`, kind: "skill" as const, name: skill.name, description: skill.description,
        ...origin(ctx, skill),
        ...(ctx.sharedPaths.has(skill.filePath) ? { library: skills.find((entry) => entry.name === skill.name) } : {}),
      })),
    ];
    return entries;
  }

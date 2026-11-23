import type { PromptTemplate } from "@earendil-works/pi-coding-agent";
import type { ResourceDiagnostic } from "@earendil-works/pi-coding-agent";
import type { RuntimeContext } from "../runtime-state.ts";

export function promptsOverride(ctx: RuntimeContext, base: { prompts: PromptTemplate[]; diagnostics: ResourceDiagnostic[] }) { return ({ ...base, prompts: [...ctx.targetResources!.prompts, ...base.prompts.filter((prompt) => !ctx.targetResources!.prompts.some((candidate) => candidate.name === prompt.name))] }); }

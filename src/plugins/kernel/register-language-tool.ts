import { Type } from "typebox";
import { Value } from "typebox/value";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { KernelLanguage, KernelLanguageChange } from "../../kernel/kernel-types.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

const parameters = Type.Object({ language: Type.Union([Type.Literal("python"), Type.Literal("bun")]) }, { additionalProperties: false });

export function registerLanguageTool(pi: ExtensionAPI, select: (language: KernelLanguage) => Promise<KernelLanguageChange>) {
  pi.registerTool({ name: "kernel_language", label: "Kernel language", exposure: "model-only", executionMode: "sequential", parameters,
    description: "Switch this idle session's kernel between Python and Bun, discarding current variables.",
    prepareArguments(args) {
      if (!Value.Check(parameters, args)) throw new WireError("INVALID_REQUEST", "Expected only language: python or bun.");
      return args;
    },
    async execute(_id, { language }) {
      const change = await select(language);
      return { content: [{ type: "text", text: change.status === "changed" ? `Kernel language set to ${language}. The next cell starts with an empty namespace.` : `Kernel language is already ${language}.` }], details: change };
    },
  });
}

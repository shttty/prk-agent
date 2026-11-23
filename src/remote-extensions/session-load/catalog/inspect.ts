import type { Extension } from "@earendil-works/pi-coding-agent";
import type { ExtensionCatalog, LoadContext } from "../load-types.ts";
import { publish } from "../status/publish-status.ts";

export function appendCatalog(previous: ExtensionCatalog, extension: Pick<Extension, "tools" | "commands">): ExtensionCatalog {
  const tools = [...previous.tools];
  for (const { definition } of extension.tools.values()) {
    tools.push({ name: definition.name, label: definition.label, description: definition.description, parameters: definition.parameters });
  }
  const commands = [...previous.commands];
  for (const { name, description } of extension.commands.values()) {
    commands.push({ name, description });
  }
  return { tools, commands };
}

export function inspect(ctx: LoadContext, extensions: readonly Extension[], errors: readonly { path: string; error: string }[]): Array<{ path: string; error: string }> {
      for (const extension of extensions) {
        const status = ctx.localEntries.get(extension.resolvedPath) ?? ctx.localEntries.get(extension.path);
        if (!status) continue;
        const catalog = appendCatalog({ tools: status.tools ?? [], commands: status.commands ?? [] }, extension);
        status.tools = catalog.tools;
        for (const { definition } of extension.tools.values()) {
          ctx.tools.set(definition.name, status);
        }
        status.commands = catalog.commands;
      }
      for (const error of errors) {
        const status = ctx.managedErrors.get(error.path);
        if (status) status.error = error.error;
      }
      publish(ctx);
      if (ctx.nativeStatus?.error) throw new Error(`Remote Pi native tools failed: ${ctx.nativeStatus.error}`);
      return errors.filter((error) => !ctx.managedErrors.has(error.path));
}

import type { NativeCommand, NativeTarget } from "../native-types.ts";
import { dynamicResources } from "./read-sdk-resources.ts";
import { staticCommands } from "./command-metadata.ts";
import { commandAvailability } from "./command-availability.ts";

/**
 * The command `/name` dispatches to, with the catalog's precedence (an extension command overrides a builtin of the
 * same name; a builtin hides a same-named skill or template) but without enumerating models, the session tree or any
 * argument candidates.
 */
export function findCommand(target: NativeTarget, name: string): NativeCommand | undefined {
  const dynamic = dynamicResources(target).commands.filter((command) => command.name === name);
  const extension = dynamic.findLast((command) => command.source === "extension");
  if (extension) return extension;
  const builtin = staticCommands.findLast((command) => command.name === name);
  if (builtin) return { ...builtin, availability: commandAvailability(builtin, target) };
  return dynamic.findLast((command) => command.source !== "extension");
}

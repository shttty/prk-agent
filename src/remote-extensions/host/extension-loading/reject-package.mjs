import { asError } from "../normalize-error.mjs";

export function rejectPackage(_ctx, owner, pkg, error) {
  pkg.error = asError(error).message;
  if (typeof error?.code === "string") pkg.errorCode = error.code;
  if (error?.details && typeof error.details === "object" && !Array.isArray(error.details)) pkg.errorDetails = error.details;
  for (const tool of pkg.tools) { owner.tools.delete(tool.toolId); owner.toolNames.delete(tool.name); }
  for (const handlerId of pkg.handlers) owner.handlers.delete(handlerId);
  for (const command of pkg.commands) owner.commandHandlers.delete(command.name);
  owner.commands = owner.commands.filter((command) => !pkg.commands.includes(command));
  pkg.tools = []; pkg.handlers = []; pkg.commands = [];
  console.error(`[remote-extension host] ${pkg.name}:`, asError(error));
}

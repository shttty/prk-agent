import { registering } from "./assert-registering.mjs";

export function registerCommand(ctx, owner, pkg, name, options) {
  registering(ctx, owner);
  if (typeof name !== "string" || !name || !options || typeof options.handler !== "function" ||
      (options.description !== undefined && typeof options.description !== "string")) throw new TypeError("Invalid remote command declaration");
  if (owner.commands.some((command) => command.name === name)) throw new Error(`Duplicate remote command: ${name}`);
  const command = { name, ...(options.description === undefined ? {} : { description: options.description }) };
  owner.commands.push(command);
  pkg.commands.push(command);
  owner.commandHandlers.set(name, options.handler);
}

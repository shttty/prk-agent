import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { WireError } from "../../gateway/wire/create-error.ts";

export function resolvePrkHome(explicitHome?: string, env: NodeJS.ProcessEnv = process.env): string {
  const selected = explicitHome ?? env.PRK_HOME ?? join(
    env.XDG_CONFIG_HOME && isAbsolute(env.XDG_CONFIG_HOME)
      ? env.XDG_CONFIG_HOME : join(env.HOME || homedir(), ".config"),
    "pi-remote-kernel",
  );
  if (typeof selected !== "string" || selected.trim().length === 0 || /\p{Cc}/u.test(selected)) throw new WireError("INVALID_REQUEST", "Invalid PRK home: expected a non-empty directory path.");
  return resolve(selected);
}

import { lstat, mkdir, unlink } from "node:fs/promises";
import { createConnection } from "node:net";
import { dirname } from "node:path";
import { WireError } from "../wire/create-error.ts";
import { DEFAULT_LIMITS_OPTIONS, type LimitsOptions } from "../../config/limits/limits-options.ts";
import { validateSocketPath } from "./validate-socket-path.ts";

export async function prepareSocket(path: string, limits: LimitsOptions = DEFAULT_LIMITS_OPTIONS): Promise<void> {
  validateSocketPath(path, limits);
  await mkdir(dirname(path), { recursive: true });
  const active = await new Promise<boolean>((resolve) => {
    const socket = createConnection(path);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
  });
  if (active) throw new WireError("PRIVATE_ENDPOINT", "Gateway is already running at this socket path.");
  try {
    if (!(await lstat(path)).isSocket()) throw new WireError("PRIVATE_ENDPOINT", "Existing endpoint path is not a socket.");
    await unlink(path);
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

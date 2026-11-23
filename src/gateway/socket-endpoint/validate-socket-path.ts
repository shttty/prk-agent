import { isAbsolute, resolve } from "node:path";
import { WireError } from "../wire/create-error.ts";
import { DEFAULT_LIMITS_OPTIONS, type LimitsOptions } from "../../config/limits/limits-options.ts";

export function validateSocketPath(path: string, limits: LimitsOptions = DEFAULT_LIMITS_OPTIONS): void {
  if (!isAbsolute(path) || resolve(path) !== path || Buffer.byteLength(path) > Math.min(limits.socketPathBytes, 100)) throw new WireError("PRIVATE_ENDPOINT", `Socket requires a normalized absolute path of at most ${Math.min(limits.socketPathBytes, 100)} bytes.`);
}

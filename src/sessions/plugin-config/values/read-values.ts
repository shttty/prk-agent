import type { PluginConfigContext } from "../config-types.ts";
import { existsSync, statSync, readFileSync } from "node:fs";
import { invalid } from "../reject-invalid-config.ts";
import { isObject } from "./is-config-object.ts";

export function readValues(ctx: PluginConfigContext, file: string): { values: Record<string, unknown>; exists: boolean } {
  if (!existsSync(file)) return { values: {}, exists: false };
  if (!statSync(file).isFile()) invalid("Config path is not a file.");
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(file, "utf8")); } catch { return invalid("Config file is not valid JSON."); }
  if (!isObject(parsed)) invalid("Config file must contain a JSON object.");
  return { values: parsed as Record<string, unknown>, exists: true };
}

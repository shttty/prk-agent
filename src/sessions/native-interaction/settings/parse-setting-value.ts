import { WireError } from "../../../gateway/wire/create-error.ts";

export function setting(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "on") return true;
  if (value === "off") return false;
  throw new WireError("INVALID_REQUEST", `${key} must be on or off.`);
}

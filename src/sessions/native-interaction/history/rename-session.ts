import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";

export async function renameSession(target: NativeTarget, request: NativeActionRequest) {
  if (!target.rename) throw new WireError("UNAVAILABLE", "Gateway session rename is unavailable.");
  const name = (request.args!.name as string).trim();
  await target.rename(name);
  return { name };
}

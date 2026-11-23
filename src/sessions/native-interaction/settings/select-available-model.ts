import type { NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";

export function availableModel(target: NativeTarget, spec: string) {
  if (target.readOnly || (!target.session && target.state !== "sleeping")) throw new WireError("READ_ONLY", "This session has no writable settings.");
  const runtime = target.session?.modelRuntime ?? target.modelRuntime;
  const separator = spec.indexOf("/");
  const model = separator > 0 ? runtime?.getModel(spec.slice(0, separator), spec.slice(separator + 1)) : undefined;
  if (!model || !runtime?.getAvailableSnapshot().some((entry) => entry.provider === model.provider && entry.id === model.id)) throw new WireError("INVALID_REQUEST", `Model ${JSON.stringify(spec)} is unavailable.`);
  return model;
}

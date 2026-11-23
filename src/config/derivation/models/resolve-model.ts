import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

export function resolveModel(spec: string, modelRuntime: ModelRuntime): NonNullable<AgentSession["model"]> {
  const separator = spec.indexOf("/");
  if (separator <= 0 || separator === spec.length - 1 || /\s/u.test(spec) || /\p{Cc}/u.test(spec)) {
    throw new Error(`Derivation model ${JSON.stringify(spec)} must use PROVIDER/MODEL format.`);
  }
  const model = modelRuntime.getModel(spec.slice(0, separator), spec.slice(separator + 1));
  if (!model) throw new Error(`Derivation model ${JSON.stringify(spec)} is unavailable.`);
  return model;
}

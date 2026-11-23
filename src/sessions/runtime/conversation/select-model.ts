import { readNativeSessionState } from "../../history/read-native-session-state.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function selectModel(ctx: RuntimeContext, persisted: ReturnType<typeof readNativeSessionState>) {
  return persisted.model === undefined
      ? ctx.dependencies.model
      : (() => {
        const separator = persisted.model.indexOf("/");
        const model = ctx.dependencies.modelRuntime.getModel(persisted.model.slice(0, separator), persisted.model.slice(separator + 1));
        if (!model || !ctx.dependencies.modelRuntime.getAvailableSnapshot().some((candidate) => candidate.provider === model.provider && candidate.id === model.id)) throw new Error(`Persisted session model ${JSON.stringify(persisted.model)} is unavailable.`);
        return model;
      })();
}

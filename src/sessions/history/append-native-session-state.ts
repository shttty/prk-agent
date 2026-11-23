import type { AgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import type { NativeSessionState } from "./history-types.ts";

export function appendNativeSessionState(target: { readonly manager: SessionManager }, source: AgentSession | NativeSessionState, models?: readonly string[]): void {
  const active = "autoCompactionEnabled" in source;
  target.manager.appendCustomEntry("gateway-native-session-state", {
    version: 1,
    autoCompaction: active ? source.autoCompactionEnabled : source.autoCompaction,
    autoRetry: active ? source.autoRetryEnabled : source.autoRetry,
    models: models ?? (active ? source.scopedModels.map((entry) => `${entry.model.provider}/${entry.model.id}`) : source.scopedModels ?? []),
  });
}

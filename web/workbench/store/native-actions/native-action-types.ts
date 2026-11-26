import type { SessionHostSnapshot } from "../../../../src/gateway/wire/web-types.ts";

/** What a native action answers with when the Gateway gave no usable reply. */
export type NativeFallback = { requestId: string; action: string; message?: string; cancellable?: boolean };

/** The conversation message a message action was started from; `metadata.custom` is what the transcript attached to it. */
export type NativeMessageRef = { role?: string; metadata?: { custom?: Record<string, unknown> } };

/** The session settings that change in the snapshot as soon as the action is sent (rolled back if it fails). */
export type LightSettingChanges = Partial<Pick<SessionHostSnapshot, "model" | "thinkingLevel" | "toolMode" | "delegation" | "kernelLanguage">>;

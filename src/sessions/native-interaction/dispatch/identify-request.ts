import type { NativeTarget } from "../native-types.ts";

export const operationKey = (target: NativeTarget, requestId: string): string => `${target.sessionId}\u0000${requestId}`;

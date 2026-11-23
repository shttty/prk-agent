import { BINDING_TYPE, PROJECT_TYPE, SESSION_RETARGET_TYPE } from "../../../src/sessions/history/history-protocol.ts";

export const LEGACY_BINDING_TYPE = "gateway-worker-binding";
export const LEGACY_KERNEL_BINDING_TYPE = "gateway-worker-kernel-binding";
export const RENAMED_TYPES = new Map([
  [LEGACY_BINDING_TYPE, BINDING_TYPE],
  ["gateway-worker-project", PROJECT_TYPE],
  ["gateway-worker-retarget", SESSION_RETARGET_TYPE],
  [LEGACY_KERNEL_BINDING_TYPE, "gateway-session-kernel-binding"],
]);

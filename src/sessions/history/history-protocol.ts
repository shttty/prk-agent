export const BINDING_TYPE = "gateway-session-binding";
export const BINDING_VERSION = 4;
export const PROJECT_TYPE = "gateway-session-project";
export const SESSION_SLEEP_TYPE = "gateway-session-sleep";
/** User-facing archive: the session is hidden but its SDK file stays until purged. */
export const ARCHIVED_STATE_TYPE = "gateway-session-trash";
/** User-facing change to a session's execution target or cwd. */
export const SESSION_RETARGET_TYPE = "gateway-session-retarget";

export const SUBJECT_SCOPED_AUTHORITY_TYPES: Record<string, true> = {
  [BINDING_TYPE]: true,
  [SESSION_SLEEP_TYPE]: true,
  [ARCHIVED_STATE_TYPE]: true,
  [SESSION_RETARGET_TYPE]: true,
  "gateway-derived-session": true,
  "gateway-derived-detached": true,
  "gateway-derived-receipt": true,
  "gateway-derived-acknowledgment": true,
};

import type { ApiFailure } from "./file-store-types.ts";

/** The Gateway refused a file request because the session's execution target is no longer the one the request named
 * (`INVALID_REQUEST`, `details.reason:"target-mismatch"`). Not a timestamp CONFLICT: nothing was executed, nothing is retried. */
export const isTargetMismatch = (error: ApiFailure | null | undefined) => error?.details?.reason === "target-mismatch";

export const TARGET_MISMATCH_NOTICE = "会话的执行环境已切换，该操作未执行。";

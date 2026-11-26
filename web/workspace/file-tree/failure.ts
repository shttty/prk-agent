import { isTargetMismatch } from "../file-store/target-mismatch.ts";
import { TARGET_MISMATCH_NOTICE } from "../file-store/target-mismatch.ts";
import type { ApiFailure } from "../file-store/file-store-types.ts";

export const failure = (error: ApiFailure) => (isTargetMismatch(error) ? TARGET_MISMATCH_NOTICE
  : error.code === "CONFLICT" ? "同名文件已存在。"
  : error.code === "TOO_LARGE" || error.status === 413 ? "文件过大。"
    : error.code === "NOT_FOUND" ? "文件不存在。" : error.message || "操作失败。");

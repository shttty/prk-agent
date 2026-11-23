import { REFERENCE_ERROR_TEXT } from "../../workbench/store/references/reference-error.js";
// Target connection, interpreter and browse failures, told by `code` and `details.reason` (never by the message).
const REASONS = {
  "python-version": "Python 版本低于 3.9，不能使用",
  "python-executable": "该路径不是可执行的 Python",
  connection: "连接命令执行失败或连接中断",
  deployment: "目标机上的部署失败",
  timeout: "连接或探测超时",
};
const CODES = { TARGET_UNREACHABLE: "无法连接目标机", BUSY: "实例有正在使用的资源", INVALID_REQUEST: "输入无效", NOT_FOUND: "实例不存在" };

/** `{code, reason, text}` for a failed inspect/browse/save; the server message rides along as detail. */
export function targetError(cause) {
  const code = typeof cause?.code === "string" ? cause.code : "";
  const reason = typeof cause?.details?.reason === "string" ? cause.details.reason : "";
  const head = REASONS[reason] || REFERENCE_ERROR_TEXT[reason]?.replace(/。$/, "") || CODES[code] || "操作失败";
  const detail = cause instanceof Error ? cause.message.trim() : "";
  return { code, reason, text: detail ? `${head}：${detail}` : `${head}。` };
}

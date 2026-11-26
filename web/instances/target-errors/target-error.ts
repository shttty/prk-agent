import { REFERENCE_ERROR_TEXT } from "../../workbench/store/references/reference-error.js";

// Target connection, interpreter and browse failures, told by `code` and `details.reason` (never by the message).
const REASONS: Record<string, string> = {
  "python-version": "Python 版本低于 3.9，不能使用",
  "python-executable": "该路径不是可执行的 Python",
  connection: "连接命令执行失败或连接中断",
  deployment: "目标机上的部署失败",
  timeout: "连接或探测超时",
};
const CODES: Record<string, string> = { TARGET_UNREACHABLE: "无法连接目标机", BUSY: "实例有正在使用的资源", INVALID_REQUEST: "输入无效", NOT_FOUND: "实例不存在" };
const REFERENCE_REASONS: Record<string, string> = REFERENCE_ERROR_TEXT;

/** A failed inspect/browse/save as the editor shows it. */
export type TargetErrorText = { code: string; reason: string; text: string };

// What a request threw is unknown; the Gateway's error carries `code` and `details.reason`.
const field = (value: unknown, key: string): unknown => (typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined);

/** `{code, reason, text}` for a failed inspect/browse/save; the server message rides along as detail. */
export function targetError(cause: unknown): TargetErrorText {
  const code = field(cause, "code");
  const reason = field(field(cause, "details"), "reason");
  const codeText = typeof code === "string" ? code : "";
  const reasonText = typeof reason === "string" ? reason : "";
  const head = REASONS[reasonText] || REFERENCE_REASONS[reasonText]?.replace(/。$/, "") || CODES[codeText] || "操作失败";
  const detail = cause instanceof Error ? cause.message.trim() : "";
  return { code: codeText, reason: reasonText, text: detail ? `${head}：${detail}` : `${head}。` };
}

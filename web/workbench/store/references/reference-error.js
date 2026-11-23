export const REFERENCE_ERROR_TEXT = {
  "missing-target": "会话没有可用的实例。",
  "invalid-path": "路径无效：不能包含反斜杠或控制字符。",
  "home-unsupported": "不支持 ~，请用绝对路径。",
  "not-directory": "不是目录。",
  "not-found": "目录不存在或不可读。",
  forbidden: "目标机拒绝访问该目录。",
  unreachable: "无法连接目标机。",
};

export function referenceError(reason, message = "") {
  return { reason: reason || "failed", text: REFERENCE_ERROR_TEXT[reason] || message || "目标文件引用查找失败。" };
}


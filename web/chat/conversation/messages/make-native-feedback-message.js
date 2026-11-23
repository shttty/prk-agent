import { safeText } from "../../../workbench/payloads/safe-text.js";
import { makeTextMessage } from "./make-text-message.js";
import { nativePayloadText } from "./native-payload-text.js";

const statusLabels = { completed: "已完成", cancelled: "已取消", failed: "失败", unavailable: "失败", running: "执行中", unknown: "结果未知" };

export function makeNativeFeedbackMessage(feedback, id, createdAt) {
  const status = safeText(feedback?.status) || "unknown";
  const action = safeText(feedback?.action) || "native";
  const command = (safeText(feedback?.command) || action).replace(/^\/+/, "");
  const message = (safeText(feedback?.message) || safeText(feedback?.content)).trim();
  const boilerplate = message === `/${action} completed.` || message === "正在执行…"
    || (action === "compact" && status === "cancelled" && /^compaction (?:cancelled|aborted)\.?$/i.test(message));
  const payload = nativePayloadText(action, feedback?.data, status);
  const text = [`/${command} · ${statusLabels[status] || statusLabels.unknown}`, !boilerplate && message, payload].filter(Boolean).join("\n");
  return makeTextMessage(text, id, createdAt, "system", { nativeFeedback: true, requestId: safeText(feedback?.requestId), status, action, ...(feedback?.data === undefined ? {} : { data: feedback.data }), ...(Array.isArray(feedback?.attachments) ? { attachments: feedback.attachments } : {}), ...(Array.isArray(feedback?.references) ? { references: feedback.references } : {}) });
}

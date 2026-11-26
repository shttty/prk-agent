import { safeText } from "../../../workbench/payloads/safe-text.js";
import type { NativeFeedback } from "../../../workbench/store/store-types.ts";
import { makeTextMessage } from "./make-text-message.ts";
import { nativePayloadText } from "./native-payload-text.ts";

const statusLabels: Record<string, string> = { completed: "已完成", cancelled: "已取消", failed: "失败", unavailable: "失败", running: "执行中", unknown: "结果未知" };

export function makeNativeFeedbackMessage(feedback: NativeFeedback, id: string, createdAt: Date) {
  const status = safeText(feedback.status) || "unknown";
  const action = safeText(feedback.action) || "native";
  const command = (safeText(feedback.command) || action).replace(/^\/+/, "");
  const message = safeText(feedback.message).trim();
  const boilerplate = message === `/${action} completed.` || message === "正在执行…"
    || (action === "compact" && status === "cancelled" && /^compaction (?:cancelled|aborted)\.?$/i.test(message));
  const payload = nativePayloadText(action, feedback.data, status);
  const text = [`/${command} · ${statusLabels[status] ?? statusLabels.unknown}`, !boilerplate && message, payload].filter(Boolean).join("\n");
  return makeTextMessage(text, id, createdAt, "system", { nativeFeedback: true, requestId: safeText(feedback.requestId), status, action, ...(feedback.data === undefined ? {} : { data: feedback.data }) });
}

import { text } from "../sidebar/text.js";
export function formatArchiveTime(value) {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

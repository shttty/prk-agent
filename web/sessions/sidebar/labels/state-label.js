import { text } from "../text.js";
export const STATUS_LABELS = {
  idle: "空闲",
  sleeping: "休眠",
  starting: "启动中",
  running: "执行中",
  cancel_requested: "取消请求中",
  closing: "关闭中",
  closed: "已关闭",
  ended: "已结束",
  unavailable: "不可用",
  not_started: "未启动",
};

export function stateLabel(value) {
  return STATUS_LABELS[value] || (value ? text(value) : "—");
}

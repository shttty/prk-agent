
export function completionLabel(status) {
  return ({ completed: "已完成", failed: "执行失败", cancelled: "已停止", canceled: "已停止", unknown: "结果未知" }[status] || status || "状态未知");
}


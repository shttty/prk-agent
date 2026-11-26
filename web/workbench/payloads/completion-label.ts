const LABELS: Record<string, string> = { completed: "已完成", failed: "执行失败", cancelled: "已停止", canceled: "已停止", unknown: "结果未知" };

export function completionLabel(status: string): string {
  return LABELS[status] || status || "状态未知";
}

export const labels: Record<string, string> = { idle: "就绪", sleeping: "休眠", running: "执行中", starting: "启动中", closing: "正在结束", closed: "已结束", unavailable: "不可用", failed: "不可用", cancel_requested: "正在停止", connected: "已连接", connecting: "正在连接", disconnected: "未连接", not_started: "未启动", busy: "忙碌", unknown: "结果未知", dead: "已退出" };

export const label = (value: string | undefined): string => (value && labels[value]) || value || "—";

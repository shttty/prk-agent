
import type { ConfigSection } from "../capability-types.ts";

// PRK's own terminal timings, rendered with the same form (values from /api/capabilities `terminal`).
export const TERMINAL_SECTIONS: ConfigSection[] = [{ title: "终端", fields: [
  { key: "yieldMs", label: "yield 间隔", type: "number", scale: 1000, unit: "秒", min: 0 },
  { key: "maxYieldMs", label: "yield 上限", type: "number", scale: 1000, unit: "秒", min: 0 },
  { key: "foregroundQuietMs", label: "前台安静判定", type: "number", scale: 1000, unit: "秒", min: 0 },
  { key: "timeoutMs", label: "命令超时", type: "number", scale: 1000, unit: "秒", min: 0, description: "0 = 不限" },
  { key: "quietNotifyDefault", label: "默认开启安静提醒", type: "boolean" },
  { key: "quietLadderMs", label: "安静提醒阶梯", type: "list", itemType: "number", scale: 1000, unit: "秒" },
  { key: "outputBytes", label: "单次输出上限", type: "number", unit: "字节", min: 4 },
  { key: "scrollbackLines", label: "回滚行数", type: "number", min: 1 },
  { key: "historyCommands", label: "命令历史条数", type: "number", min: 1 },
] }];

import { IconCheck } from "@tabler/icons-react";
import { IconLoader2 } from "@tabler/icons-react";
import { IconPlayerStopFilled } from "@tabler/icons-react";
import { IconAlertTriangle } from "@tabler/icons-react";
import { IconHelpCircle } from "@tabler/icons-react";
import { IconCircleDashed } from "@tabler/icons-react";
export const TOOL_STATE_ICONS = { done: IconCheck, running: IconLoader2, interrupted: IconPlayerStopFilled, error: IconAlertTriangle, unknown: IconHelpCircle, pending: IconCircleDashed };

export const TOOL_TITLES = { session_send: "发送会话消息", session_list: "列出会话", session_manage: "管理会话" };

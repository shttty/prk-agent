import type { Icon } from "@tabler/icons-react";
import type { TodoStatus } from "./todo-types.ts";
import { IconCircle } from "@tabler/icons-react";
import { IconCircleDot } from "@tabler/icons-react";
import { IconCircleCheckFilled } from "@tabler/icons-react";
import { IconCircleMinus } from "@tabler/icons-react";
import { IconAlertCircle } from "@tabler/icons-react";
export const ICONS: Record<TodoStatus, Icon> = { pending: IconCircle, in_progress: IconCircleDot, completed: IconCircleCheckFilled, cancelled: IconCircleMinus, blocked: IconAlertCircle };

export const BAR_ORDER: readonly TodoStatus[] = ["completed", "cancelled", "in_progress", "blocked", "pending"];

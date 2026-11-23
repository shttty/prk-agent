import { IconCircle } from "@tabler/icons-react";
import { IconCircleDot } from "@tabler/icons-react";
import { IconCircleCheckFilled } from "@tabler/icons-react";
import { IconCircleMinus } from "@tabler/icons-react";
import { IconAlertCircle } from "@tabler/icons-react";
export const ICONS = { pending: IconCircle, in_progress: IconCircleDot, completed: IconCircleCheckFilled, cancelled: IconCircleMinus, blocked: IconAlertCircle };

export const BAR_ORDER = ["completed", "cancelled", "in_progress", "blocked", "pending"];

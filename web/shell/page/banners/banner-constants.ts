import type { ComponentProps } from "react";
import type StatusDot from "../../../design-system/status-dot/StatusDot.tsx";

export const TONES: Record<"error" | "warn" | "info", ComponentProps<typeof StatusDot>["tone"]> = { error: "error", warn: "warn", info: "idle" };

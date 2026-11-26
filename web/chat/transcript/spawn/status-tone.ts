import type { ComponentProps } from "react";
import type StatusDot from "../../../design-system/status-dot/StatusDot.tsx";

type StatusTone = ComponentProps<typeof StatusDot>["tone"];
const TONES: readonly string[] = ["ok", "error", "warn", "idle", "sleep", "run"];

const isTone = (value: string): value is StatusTone => TONES.includes(value);

/** A sidebar row's tone as a StatusDot tone; the row labels only ever produce these. */
export const statusTone = (value: string): StatusTone => isTone(value) ? value : "idle";

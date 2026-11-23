import type { SessionControl } from "../../sessions/session-control/control-types.ts";

export interface ControlState {
  path: string;
  value: SessionControl;
}

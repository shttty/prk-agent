/** Row states (sessions/sidebar/labels/row-state.ts keys) of a child session that is still at work: counted as
 * "运行中" by the spawn card and the monitor's child list. */
export const IN_FLIGHT = new Set(["starting", "running", "cancel_requested"]);

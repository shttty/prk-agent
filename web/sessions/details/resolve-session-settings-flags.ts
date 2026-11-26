type Flags = { connection: string; hostState: string | undefined; nativePending: boolean };

/** Pure view state for SessionSettings so running/sleeping logic stays testable. */
export function resolveSessionSettingsFlags({ connection, hostState, nativePending }: Flags) {
  const live = connection === "connected" && !nativePending;
  const idle = hostState === "idle" && live;
  return { live, idle };
}

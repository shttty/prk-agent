/** Pure view-state helpers for SessionSettings so running/sleeping/switch-value logic stays testable. */
export function resolveSessionSettingsFlags({ connection, hostState, nativePending }) {
  const live = connection === "connected" && !nativePending;
  const idle = hostState === "idle" && live;
  return { live, idle };
}

export function resolveSettingValues(loaded, sessionKey, catalogCurrent) {
  const matched = loaded && loaded.key === sessionKey ? loaded.data : null;
  if (matched) return matched;
  if (catalogCurrent && (typeof catalogCurrent.autoCompaction === "boolean" || typeof catalogCurrent.autoRetry === "boolean")) {
    return {
      autoCompaction: catalogCurrent.autoCompaction === true,
      autoRetry: catalogCurrent.autoRetry === true,
    };
  }
  return null;
}

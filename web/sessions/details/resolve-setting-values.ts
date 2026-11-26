export type SettingValues = Partial<Record<"autoCompaction" | "autoRetry", boolean>>;
export type LoadedSettings = { key: string; data: SettingValues };

/** The light-setting values to show: what was loaded for this session, else what its native catalog currently reports. */
export function resolveSettingValues(loaded: LoadedSettings | null, sessionKey: string, catalogCurrent: SettingValues | undefined): SettingValues | null {
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

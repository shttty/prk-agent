import { useLocalStorage } from "@mantine/hooks";

/** The browser's debug-mode switch (Settings): while it is off, no debug tool shows up anywhere in the workspace. */
export function useDebugModePreference() {
  return useLocalStorage<boolean>({ key: "pi-debug-mode", defaultValue: false, getInitialValueInEffect: false, deserialize: (value) => value === "true" });
}

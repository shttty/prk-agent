import { useLocalStorage } from "@mantine/hooks";

export function useTerminalCursorBlink() {
  return useLocalStorage<boolean>({ key: "pi-terminal-cursor-blink", defaultValue: false, getInitialValueInEffect: false, deserialize: (value: string | undefined) => value === "true" });
}

import { useLocalStorage } from "@mantine/hooks";

export function useTerminalCursorBlink() {
  return useLocalStorage({ key: "pi-terminal-cursor-blink", defaultValue: false, getInitialValueInEffect: false, deserialize: (value) => value === "true" });
}

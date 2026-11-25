import { useLocalStorage } from "@mantine/hooks";

export function useTurnFoldMode() {
  return useLocalStorage({ key: "pi-turn-fold-mode", defaultValue: "segmented", getInitialValueInEffect: false,
    serialize: (value) => value, deserialize: (value) => value === "whole" ? "whole" : "segmented" });
}

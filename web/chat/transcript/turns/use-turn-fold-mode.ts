import { useLocalStorage } from "@mantine/hooks";
import type { TurnFoldMode } from "../presentation-types.ts";

export function useTurnFoldMode() {
  return useLocalStorage<TurnFoldMode>({ key: "pi-turn-fold-mode", defaultValue: "segmented", getInitialValueInEffect: false,
    serialize: (value) => value, deserialize: (value) => value === "whole" ? "whole" : "segmented" });
}

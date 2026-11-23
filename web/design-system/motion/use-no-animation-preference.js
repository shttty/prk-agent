import { useLocalStorage } from "@mantine/hooks";

export function useNoAnimationPreference() {
  return useLocalStorage({ key: "pi-no-animation", defaultValue: false, getInitialValueInEffect: false, deserialize: (value) => value === "true" });
}

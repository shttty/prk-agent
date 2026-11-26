import { useLocalStorage } from "@mantine/hooks";

export function useNoAnimationPreference() {
  return useLocalStorage<boolean>({ key: "pi-no-animation", defaultValue: false, getInitialValueInEffect: false, deserialize: (value) => value === "true" });
}

import { useReducedMotion } from "@mantine/hooks";
import { useNoAnimationPreference } from "./use-no-animation-preference.ts";

export function useNoAnimation(): boolean {
  const [enabled] = useNoAnimationPreference();
  const system = useReducedMotion(false, { getInitialValueInEffect: false });
  return enabled || system;
}

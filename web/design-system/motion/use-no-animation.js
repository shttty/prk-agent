import { useReducedMotion } from "@mantine/hooks";
import { useNoAnimationPreference } from "./use-no-animation-preference.js";

export function useNoAnimation() {
  const [enabled] = useNoAnimationPreference();
  const system = useReducedMotion(false, { getInitialValueInEffect: false });
  return enabled || system;
}

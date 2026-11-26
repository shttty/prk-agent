import type { MotionDuration } from "./motion-types.ts";
import { readMotionToken } from "./read-motion-token.ts";

/** A duration token as milliseconds, for WAAPI and Mantine's transitionProps (Mantine also times the unmount with it). */
export function motionMs(name: MotionDuration): number {
  const value = readMotionToken(name);
  return value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000;
}

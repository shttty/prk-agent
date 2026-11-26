/** The --pi-motion-* tokens that code reads or applies (tokens.css). */
export type MotionDuration = "instant" | "fast" | "base" | "slow";
export type MotionEase = "ease-out" | "ease-in" | "ease-swap";
/** The side a panel or overlay comes from and leaves to. */
export type MotionEdge = "left" | "right" | "up" | "down";
/** A --pi-motion-* length: how far an overlay (rise) or a panel (slide) travels. */
export type MotionDistance = "rise" | "slide";

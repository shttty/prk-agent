import type { CSSProperties } from "react";

/** A style object that may also set custom properties (`--pi-…`), which React's CSSProperties does not list. */
export type CssVarStyle = CSSProperties & Record<`--${string}`, string | number>;

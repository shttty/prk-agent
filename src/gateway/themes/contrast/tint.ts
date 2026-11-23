import type Color from "colorjs.io";
import { over } from "./over.ts";

export const tint = (code: Color, c: (key: string) => Color, key: string, share: number, base = code) => { const color = c(key); color.alpha = (color.alpha ?? 1) * share; return over(color, base); };

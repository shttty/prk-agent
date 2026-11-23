import type Color from "colorjs.io";

export const mix = (a: Color, b: Color, share: number) => a.mix(b, share, { space: "srgb" });

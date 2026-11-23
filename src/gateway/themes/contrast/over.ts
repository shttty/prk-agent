import Color from "colorjs.io";

// Alpha-composite in sRGB, matching the code card's translucent tints and gutter.
export function over(foreground: Color, background: Color): Color {
  const fg = foreground.to("srgb"), bg = background.to("srgb");
  const alpha = fg.alpha ?? 1;
  return new Color("srgb", fg.coords.map((channel, i) => (channel ?? 0) * alpha + (bg.coords[i] ?? 0) * (1 - alpha)) as [number, number, number]);
}

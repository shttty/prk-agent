import { palette } from "../../../../shared/palette.js";

const hexOrRgb = (value) => {
  if (value.startsWith("#")) return { r: parseInt(value.slice(1, 3), 16), g: parseInt(value.slice(3, 5), 16), b: parseInt(value.slice(5, 7), 16), a: 1 };
  const m = value.match(/rgb\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+)%)?\)/);
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] ? +m[4] / 100 : 1 };
};
const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
const luminance = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrastOf = (fg, bg) => { const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x); return +((hi + 0.05) / (lo + 0.05)).toFixed(2); };
export function tokenContrast(scheme) {
  const { tokens } = palette[scheme];
  // Translucent layers are measured over what they sit on: the overlay over the darkest surface it floats above.
  const under = (surface) => hexOrRgb(surface === "overlay" ? tokens.sidebar : tokens.bg);
  const surfaces = ["bg", "sidebar", "tree", "sidebar-selected", "surface", "surface-2", "overlay", "overlay-solid", "bubble-user", "selected"];
  const result = {};
  for (const text of ["ink", "ink-2", "muted", "faint", "accent-strong", "ok", "danger", "warn"]) {
    const ratios = Object.fromEntries(surfaces.map((surface) => { const bg = blend(hexOrRgb(tokens[surface]), under(surface)); return [surface, contrastOf(blend(hexOrRgb(tokens[text]), bg), bg)]; }));
    result[text] = { min: Math.min(...Object.values(ratios)), ...ratios };
  }
  return result;
}

import assert from "node:assert/strict";

export async function checkContrast(w1, scheme, tag) {
  // Contrast of secondary text (computed colours): comment, line number, note.
  const contrast = await w1.evaluate((root) => {
    const parse = (css) => { const c = css.match(/color\(srgb ([^)]+)\)/); if (c) { const [r, g, b, a = 1] = c[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: r * 255, g: g * 255, b: b * 255, a }; } const m = css.match(/rgba?\(([^)]+)\)/); const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (fg, bg) => { const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
    const bg = parse(getComputedStyle(root.querySelector(".pi-io")).backgroundColor);
    const page = parse(getComputedStyle(document.body).backgroundColor);
    const under = bg.a > 0 ? bg : page;
    const color = (el, pseudo) => parse(getComputedStyle(el, pseudo).color);
    return {
      comment: ratio(color(root.querySelector(".tok-comment")), under),
      number: ratio(color(root.querySelector(".pi-cl"), "::before"), under),
      note: ratio(color(root.querySelector(".pi-io-note")), under),
    };
  });
  const floor = scheme === "dark" ? 5.5 : 3.5;
  for (const [name, value] of Object.entries(contrast)) assert(value >= floor, `${tag} ${name} contrast ${value.toFixed(2)} >= ${floor}`);
}

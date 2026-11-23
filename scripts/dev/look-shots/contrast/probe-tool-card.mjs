export const probeToolCard = () => {
  const parse = (css) => {
    const srgb = css.match(/color\(srgb ([^)]+)\)/);
    const m = srgb || css.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return srgb ? { r: r * 255, g: g * 255, b: b * 255, a } : { r, g, b, a };
  };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const ratio = (fg, bg) => { const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x); return +((hi + 0.05) / (lo + 0.05)).toFixed(2); };
  const base = parse(getComputedStyle(document.body).backgroundColor);
  const bgOf = (el) => { let node = el; while (node) { const c = parse(getComputedStyle(node).backgroundColor); if (c && c.a > 0) return over(c, base); node = node.parentElement; } return base; };
  const card = {};
  const record = (name, el, pseudo) => { if (!el) return; const fg = parse(getComputedStyle(el, pseudo).color); const bg = bgOf(el); card[name] = ratio(over(fg, bg), bg); };
  record("comment", document.querySelector(".pi-io .tok-comment"));
  record("line-number", document.querySelector(".pi-cl-numbers .pi-cl"), "::before");
  record("output-rule-label", document.querySelector(".pi-io-rule span"));
  record("note", document.querySelector(".pi-io-note"));
  return card;
};

import { css } from "../terminal-theme.js";

// xterm draws match backgrounds only from #RRGGBB; a theme colour with alpha leaves that match without a background.
const opaqueHex = (value) => {
  const context = document.createElement("canvas").getContext("2d");
  context.fillStyle = value;
  return /^#[0-9a-f]{6}$/iu.test(context.fillStyle) ? context.fillStyle : undefined;
};

/** Search highlight colours from the page theme: matches in the inactive selection colour, the current one in the
 * selection colour with an accent border. */
export function searchDecorations(element) {
  const accent = css(element, "--pi-accent");
  return {
    matchBackground: opaqueHex(css(element, "--pi-term-selection-inactive")),
    matchOverviewRuler: accent,
    activeMatchBackground: opaqueHex(css(element, "--pi-term-selection")),
    activeMatchBorder: accent,
    activeMatchColorOverviewRuler: accent,
  };
}

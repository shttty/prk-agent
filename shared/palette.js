// The only place colours live. Each scheme is { tokens, scales }:
//   tokens — every --pi-* colour the hand-written CSS reads (written to CSS by theme.js's resolver as --pi-<name>);
//   scales — Mantine palettes (10 shades, light to dark). Mantine computes contrast from them in JS, so they must be
//            real colours; `accent` and `gray` back the virtual colours of the same name, `dark` is Mantine's dark scale.
// Swapping a theme = replacing this object; theme.js derives the rest (Mantine's variables, the --pi-* CSS variables).
// Text-bearing tokens must reach WCAG AA 4.5 on every surface.

export const palette = {
  // Light (2026-10-17, "D"): the session sidebar sits flat on a hue-free canvas, chat / workspace / terminal are white
  // cards on it; floating layers are translucent white (blur in CSS); soft, short shadows. Sea-teal accent; code uses
  // GitHub Light (comment uses Primer fg.muted to reach AA).
  light: {
    tokens: {
      // surfaces
      "bg": "#FFFFFF",
      "sidebar": "#F7F7F8",
      "tree": "#FFFFFF", // file-tree column + its collapsed rail (matches chat card bg)
      "sidebar-selected": "#FFFFFF",
      "sidebar-hover": "#F0F0F2", // neutral fills of the session sidebar: hovered row, current row (hue-free, text keeps AA)
      "sidebar-active": "#E5E5E8",
      "surface": "#FFFFFF",
      "surface-2": "#F0F0F2",
      "overlay": "rgb(255 255 255 / 86%)",
      "overlay-solid": "#FFFFFF",
      "bubble-user": "#EFEFF1",
      "hover": "rgb(59 120 152 / 11%)",
      "selected": "#DCE8F6",
      "scrim": "rgb(28 28 27 / 28%)",
      "scrim-soft": "rgb(28 28 27 / 14%)",
      // text
      "ink": "#1C1C1B",
      "ink-2": "#353533",
      "muted": "#5C5B57",
      "faint": "#666561",
      // lines
      "line": "#E8E8EC",
      "line-strong": "#D4D4DA",
      "track": "#ECECEF",
      "card-line": "#E8E8EC",
      // accent
      "accent": "#3B7898",
      "accent-strong": "#245773",
      "accent-soft": "rgb(59 120 152 / 12%)",
      "accent-ring": "rgb(59 120 152 / 45%)",
      // states
      "ok": "#24734A",
      "ok-ring": "rgb(36 115 74 / 45%)",
      "danger": "#B3261E",
      "warn": "#8A5300",
      // code
      "code-bg": "#F6F8FA",
      "code-ink": "#1F2328",
      "code-inline-bg": "#EFEFEC",
      "term-selection": "#BFD9E6", // terminal selection: code-ink stays >= 4.5 on it, clearly apart from code-bg
      "term-selection-inactive": "#CEE0EA", // same, terminal not focused (e.g. while its menu is open)
      // effects
      "shadow": "0 1px 2px rgb(0 0 0 / 4%), 0 4px 12px -6px rgb(0 0 0 / 8%)",
      "shadow-overlay": "0 1px 3px rgb(0 0 0 / 5%), 0 10px 24px -10px rgb(0 0 0 / 14%)",
      "shadow-composer": "0 1px 3px rgb(0 0 0 / 8%), 0 8px 24px -8px rgb(0 0 0 / 22%)",
      "shimmer": "rgb(255 255 255 / 65%)",
      // syntax
      "syn-keyword": "#CF222E",
      "syn-number": "#0550AE",
      "syn-string": "#0A3069",
      "syn-string2": "#0A3069",
      "syn-type": "#953800",
      "syn-function": "#8250DF",
      "syn-property": "#0550AE",
      "syn-operator": "#1F2328",
      "syn-comment": "#59636E",
      "syn-heading": "#0550AE",
      "syn-link": "#0A3069",
      "syn-inserted": "#116329",
      "syn-deleted": "#82071E",
    },
    scales: {
      accent: ["#EAF2F6", "#D2E4EE", "#B0CFE0", "#86B5CF", "#5C98B8", "#3B7898", "#245773", "#1E4960", "#183A4D", "#122C3A"],
      gray: ["#FBFBFA", "#F3F3F2", "#EAEAE7", "#E4E4E1", "#D4D4D0", "#C4C4C0", "#8A8985", "#6B6A66", "#5C5B57", "#1C1C1B"],
    },
  },
  // Dark (2026-10-17, "D"): Nord — Polar Night surfaces with the cards barely lighter than the canvas, parted by a faint
  // card line; Snow Storm text, Frost accent, Aurora states lightened for AA; code uses One Dark colours; comment
  // lightened to >= 5.5 on the tool card (check-tool-bodies floor), red to AA on code-bg.
  dark: {
    tokens: {
      // surfaces
      "bg": "#2E3440",
      "sidebar": "#2A2F3A",
      "tree": "#2E3440", // file-tree column + its collapsed rail (matches chat card bg)
      "sidebar-selected": "#3A4858",
      "sidebar-hover": "#30353F", // neutral fills of the session sidebar: hovered row, current row
      "sidebar-active": "#3A3F49",
      "surface": "#353C4A",
      "surface-2": "#3B4252",
      "overlay": "rgb(55 62 76 / 88%)",
      "overlay-solid": "#373E4C",
      "bubble-user": "#383E4A",
      "hover": "rgb(136 192 208 / 11%)",
      "selected": "#3A4858",
      "scrim": "rgb(20 23 30 / 50%)",
      "scrim-soft": "rgb(20 23 30 / 30%)",
      // text
      "ink": "#ECEFF4",
      "ink-2": "#E5E9F0",
      "muted": "#D8DEE9",
      "faint": "#B6BECC",
      // lines
      "line": "#3B4252",
      "line-strong": "#4C566A",
      "track": "#3B4252",
      "card-line": "#343A47",
      // accent
      "accent": "#88C0D0",
      "accent-strong": "#A5D2DE",
      "accent-soft": "rgb(136 192 208 / 15%)",
      "accent-ring": "rgb(136 192 208 / 50%)",
      // states
      "ok": "#AECA97",
      "ok-ring": "rgb(174 202 151 / 40%)",
      "danger": "#EFAEB3",
      "warn": "#EBCB8B",
      // code
      "code-bg": "#272C36",
      "code-ink": "#D8DEE9",
      "code-inline-bg": "#3B4252",
      "term-selection": "#3F5868",
      "term-selection-inactive": "#3A4858",
      // effects
      "shadow": "0 1px 2px rgb(0 0 0 / 14%), 0 4px 12px -6px rgb(0 0 0 / 22%)",
      "shadow-overlay": "0 1px 3px rgb(0 0 0 / 18%), 0 10px 24px -10px rgb(0 0 0 / 32%)",
      "shadow-composer": "0 1px 2px rgb(0 0 0 / 22%), 0 6px 20px -6px rgb(0 0 0 / 40%)",
      "shimmer": "rgb(255 255 255 / 6%)",
      // syntax
      "syn-keyword": "#C678DD",
      "syn-number": "#D19A66",
      "syn-string": "#98C379",
      "syn-string2": "#56B6C2",
      "syn-type": "#E5C07B",
      "syn-function": "#61AFEF",
      "syn-property": "#E57F87",
      "syn-operator": "#56B6C2",
      "syn-comment": "#A6ADB9",
      "syn-heading": "#E57F87",
      "syn-link": "#61AFEF",
      "syn-inserted": "#98C379",
      "syn-deleted": "#E57F87",
    },
    scales: {
      accent: ["#E6F3F6", "#CBE6EC", "#B0D9E2", "#9ACDD9", "#88C0D0", "#6FA9BB", "#5E92A6", "#4E7A8C", "#3E6272", "#2F4A57"],
      gray: ["#ECEFF4", "#E5E9F0", "#D8DEE9", "#B8C0CE", "#98A2B3", "#7B879B", "#616E88", "#4C566A", "#434C5E", "#3B4252"],
      dark: ["#ECEFF4", "#D8DEE9", "#A7B0C0", "#7B879B", "#4C566A", "#434C5E", "#3B4252", "#2E3440", "#272C36", "#20242C"],
    },
  },
};

// Scheme-independent hues for Mantine components that ask for blue / green / violet by name.
export const hues = {
  blue: ["#EAF2F4", "#D3E3E8", "#AFCBD4", "#86AFBD", "#6297A8", "#4A8296", "#3D6F82", "#325B6B", "#274855", "#1C3540"],
  green: ["#EEF4EF", "#DCE8DE", "#BFD5C4", "#A1C0A9", "#86AD91", "#6E9A7B", "#5C8569", "#4B6E57", "#3B5745", "#2B4033"],
  violet: ["#F4EFF4", "#E7DDE8", "#D2C0D4", "#BCA1BF", "#A886AC", "#966F9A", "#7F5C83", "#684B6B", "#523B55", "#3C2B3E"],
};

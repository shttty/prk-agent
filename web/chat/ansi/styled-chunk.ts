import webTheme from "../../../shared/pi-web-theme.json";
// Web tone of every Pi 1.2 foreground token. Tones are styled with --pi-* variables in extension-ui.css.
export const TOKEN_TONES: Record<string, string[]> = {
  success: ["success", "toolDiffAdded"],
  danger: ["error", "toolDiffRemoved"],
  warning: ["warning"],
  accent: ["accent", "borderAccent", "customMessageLabel", "mdHeading", "mdLink", "mdCode", "mdListBullet", "syntaxKeyword", "syntaxFunction", "syntaxType", "bashMode", "thinkingLow", "thinkingMedium", "thinkingHigh", "thinkingXhigh", "thinkingMax"],
  text: ["text", "userMessageText", "toolTitle", "mdCodeBlock", "syntaxVariable", "syntaxString", "syntaxNumber", "searchMatchText", "scrollbarThumb"],
  muted: ["muted", "border", "toolOutput", "customMessageText", "thinkingText", "mdLinkUrl", "mdQuote", "toolDiffContext", "syntaxComment", "syntaxOperator", "syntaxPunctuation", "thinkingMinimal"],
  dim: ["dim", "borderMuted", "mdCodeBlockBorder", "mdQuoteBorder", "mdHr", "scrollbarTrack", "thinkingOff"],
};

// Hard-coded 16 colors (SGR 30–37/90–97): fixed lookup, no color math. 256-color and truecolor get no tone.
export const NAMED_TONES = {
  red: "danger", "bright-red": "danger", green: "success", "bright-green": "success", yellow: "warning", "bright-yellow": "warning",
  blue: "accent", "bright-blue": "accent", cyan: "accent", "bright-cyan": "accent", magenta: "accent", "bright-magenta": "accent",
  black: "muted", "bright-black": "muted", white: "text", "bright-white": "text",
};

export const toneOf = new Map<string, string>(Object.entries(TOKEN_TONES).flatMap(([tone, tokens]) => tokens.map((token) => [token, tone])));

// The host renders plugin UI with shared/pi-web-theme.json, so each palette index there identifies one token.
export const tokenOf = new Map<string, string>(Object.entries(webTheme.colors).filter(([, value]) => typeof value === "number").map(([token, index]) => [`ansi-palette-${index}`, token]));

export const STYLES = new Set(["bold", "dim", "italic", "underline", "strikethrough"]);

function isNamedColor(color: string): color is keyof typeof NAMED_TONES { return color in NAMED_TONES; }

export function foreground(fg: string): { token?: string; tone?: string; color?: string } {
  if (!fg) return {};
  const token = tokenOf.get(fg);
  if (token) return { token, tone: toneOf.get(token) };
  const color = fg.replace(/^ansi-/, "");
  return { color, tone: isNamedColor(color) ? NAMED_TONES[color] : undefined };
}

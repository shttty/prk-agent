import { palette } from "./palette.js";

export const builtinThemes = Object.entries(palette).map(([mode, { tokens }]) => ({
  id: `builtin-${mode}`,
  builtin: true,
  name: mode === "light" ? "内置浅色" : "内置深色",
  mode,
  tokens: Object.fromEntries(Object.entries(tokens).filter(([key]) => !key.startsWith("shadow")).map(([key, value]) => [`--pi-${key}`, value])),
}));

export function resolvedTokens(theme) {
  return { ...builtinThemes.find((entry) => entry.mode === theme.mode).tokens, ...theme.tokens };
}

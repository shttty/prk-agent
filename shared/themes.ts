import { palette } from "./palette.ts";

export type ThemeDocument = {
  name: string;
  mode: "light" | "dark";
  tokens: Record<string, string>;
};
export type ThemeEntry = ThemeDocument & { id: string; builtin: boolean };
export type ThemeWarning = { id: string; label: string; ratio: number };
export type ThemeLibrary = { themes: ThemeEntry[] };
export type ThemePreview = { theme: ThemeDocument; warnings: ThemeWarning[] };
export type ThemeImport = { theme: ThemeEntry; warnings: ThemeWarning[] };

export const builtinThemes: ThemeEntry[] = (["light", "dark"] as const).map((mode) => ({
  id: `builtin-${mode}`,
  builtin: true,
  name: mode === "light" ? "内置浅色" : "内置深色",
  mode,
  tokens: Object.fromEntries(Object.entries(palette[mode].tokens).filter(([key]) => !key.startsWith("shadow")).map(([key, value]) => [`--pi-${key}`, value])),
}));

export function resolvedTokens(theme: ThemeDocument): Record<string, string> {
  return { ...builtinThemes.find((entry) => entry.mode === theme.mode)?.tokens, ...theme.tokens };
}

export interface ThemeDocument {
  name: string;
  mode: "light" | "dark";
  tokens: Record<string, string>;
}
export interface ThemeEntry extends ThemeDocument { id: string; builtin: boolean }
export interface ThemeWarning { id: string; label: string; ratio: number }
export interface ThemeLibrary { themes: ThemeEntry[] }
export interface ThemePreview { theme: ThemeDocument; warnings: ThemeWarning[] }
export interface ThemeImport { theme: ThemeEntry; warnings: ThemeWarning[] }
export const builtinThemes: ThemeEntry[];
export function resolvedTokens(theme: ThemeDocument): Record<string, string>;

import { MantineProvider, type CSSVariablesResolver, type MantineColorsTuple, type MantineThemeOverride } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThemeEntry } from "../../../src/gateway/wire/web-types.ts";
import { palette } from "../../../shared/palette.ts";
import { builtinThemes, resolvedTokens } from "../../../shared/themes.ts";
import { useDocumentMotion } from "../motion/use-document-motion.ts";
import { colorSchemeStorage } from "./color-scheme-storage.ts";
import { cssVariablesResolver } from "./css-variables-resolver.ts";
import { theme } from "./mantine-theme.ts";
import { motionComponents } from "./motion-components.ts";
import { ThemeScheme } from "./ThemeScheme.tsx";
import { ThemeLibraryContext, type ThemeApi } from "./use-theme-library.ts";

type ThemeProviderProps = { api: ThemeApi; children: ReactNode };
type Appearance = { theme: MantineThemeOverride; resolver: CSSVariablesResolver };

export default function ThemeProvider({ api, children }: ThemeProviderProps) {
  const [selectedId, setSelectedId] = useLocalStorage<string>({ key: "pi-session-color-theme", defaultValue: "", getInitialValueInEffect: false });
  const [themes, setThemes] = useState<ThemeEntry[]>(builtinThemes);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { const result = await api.post("/themes/list"); setThemes(result.themes); setError(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  }, [api]);
  useEffect(() => { if (selectedId && !selectedId.startsWith("builtin-")) void refresh(); }, [selectedId, refresh]);
  const selected = themes.find((entry) => entry.id === selectedId);
  const noAnimation = useDocumentMotion();
  const moving = useMemo<MantineThemeOverride>(() => ({ ...theme, respectReducedMotion: true, components: { ...theme.components, ...motionComponents(noAnimation) } }), [noAnimation]);
  const appearance = useMemo<Appearance>(() => selected && !selected.builtin ? customAppearance(selected, moving) : { theme: moving, resolver: cssVariablesResolver }, [selected, moving]);
  return <ThemeLibraryContext.Provider value={{ api, themes, setThemes, selectedId, setSelectedId, selected, refresh, error }}>
    <MantineProvider theme={appearance.theme} cssVariablesResolver={appearance.resolver} colorSchemeManager={colorSchemeStorage} defaultColorScheme="auto">
      <ThemeScheme mode={selected?.mode} />
      {children}
    </MantineProvider>
  </ThemeLibraryContext.Provider>;
}

/** An imported theme replaces the accent shades Mantine derives colours from, and writes its tokens over the scheme's. */
function customAppearance(selected: ThemeEntry, moving: MantineThemeOverride): Appearance {
  const tokens = resolvedTokens(selected);
  const scale = palette[selected.mode].scales.accent;
  const accent = selected.mode === "light" ? "lightAccent" : "darkAccent";
  return {
    theme: { ...moving, colors: { ...moving.colors, [accent]: withAccent(scale, tokens["--pi-accent"] ?? scale[4], tokens["--pi-accent-strong"] ?? scale[6]) } },
    resolver: () => {
      const variables = cssVariablesResolver();
      Object.assign(variables[selected.mode], tokens, {
        "--mantine-color-accent-filled": "var(--pi-accent)",
        "--mantine-color-accent-filled-hover": "var(--pi-accent-strong)",
        "--mantine-color-accent-light": "var(--pi-accent-soft)",
        "--mantine-color-accent-light-hover": "var(--pi-accent-soft)",
        "--mantine-color-accent-light-color": "var(--pi-accent-strong)",
        "--mantine-color-accent-outline": "var(--pi-accent-strong)",
        "--mantine-color-accent-outline-hover": "var(--pi-accent-soft)",
      });
      return variables;
    },
  };
}

/** The scale with shade 4 (dark primary) and shade 6 (light primary) replaced. */
function withAccent([s0, s1, s2, s3, , s5, , s7, s8, s9]: MantineColorsTuple, primary: string, strong: string): MantineColorsTuple {
  return [s0, s1, s2, s3, primary, s5, strong, s7, s8, s9];
}

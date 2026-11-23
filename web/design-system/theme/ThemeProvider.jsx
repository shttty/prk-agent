import { useLocalStorage } from "@mantine/hooks";
import { useState } from "react";
import { builtinThemes } from "../../../shared/themes.js";
import { useCallback } from "react";
import { useEffect } from "react";
import { useMemo } from "react";
import { theme } from "./mantine-theme.js";
import { cssVariablesResolver } from "./css-variables-resolver.js";
import { resolvedTokens } from "../../../shared/themes.js";
import { ThemeLibraryContext } from "./use-theme-library.js";
import { MantineProvider } from "@mantine/core";
import { colorSchemeManager } from "./color-scheme-manager.js";
import { ThemeScheme } from "./ThemeScheme.jsx";
import { useDocumentMotion } from "../motion/use-document-motion.js";
import { motionComponents } from "./motion-components.js";
export default function ThemeProvider({ api, children }) {
  const [selectedId, setSelectedId] = useLocalStorage({ key: "pi-session-color-theme", defaultValue: "", getInitialValueInEffect: false });
  const [themes, setThemes] = useState(builtinThemes);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { const result = await api.post("/themes/list"); setThemes(result.themes); setError(""); }
    catch (failure) { setError(failure.message); }
  }, [api]);
  useEffect(() => { if (selectedId && !selectedId.startsWith("builtin-")) void refresh(); }, [selectedId, refresh]);
  const selected = themes.find((entry) => entry.id === selectedId);
  const noAnimation = useDocumentMotion();
  const moving = useMemo(() => ({ ...theme, respectReducedMotion: true, components: { ...theme.components, ...motionComponents(noAnimation) } }), [noAnimation]);
  const appearance = useMemo(() => {
    if (!selected || selected.builtin) return { theme: moving, resolver: cssVariablesResolver };
    const tokens = resolvedTokens(selected);
    const accent = selected.mode === "light" ? "lightAccent" : "darkAccent";
    const shades = [...moving.colors[accent]];
    shades[4] = tokens["--pi-accent"];
    shades[6] = tokens["--pi-accent-strong"];
    return {
      theme: { ...moving, colors: { ...moving.colors, [accent]: shades } },
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
  }, [selected, moving]);
  return <ThemeLibraryContext.Provider value={{ api, themes, setThemes, selectedId, setSelectedId, selected, refresh, error }}>
    <MantineProvider theme={appearance.theme} cssVariablesResolver={appearance.resolver} colorSchemeManager={colorSchemeManager} defaultColorScheme="auto">
      <ThemeScheme mode={selected?.mode} />
      {children}
    </MantineProvider>
  </ThemeLibraryContext.Provider>;
}


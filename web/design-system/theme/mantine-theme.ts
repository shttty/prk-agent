import { Alert, Switch, createTheme, parseThemeColor, virtualColor } from "@mantine/core";
import { hues, palette } from "../../../shared/palette.ts";
import "../switch/pill-switch.css";

export const theme = createTheme({
  colors: {
    lightAccent: palette.light.scales.accent,
    lightGray: palette.light.scales.gray,
    darkAccent: palette.dark.scales.accent,
    darkGray: palette.dark.scales.gray,
    dark: palette.dark.scales.dark,
    ...hues,
    accent: virtualColor({ name: "accent", light: "lightAccent", dark: "darkAccent" }),
    gray: virtualColor({ name: "gray", light: "lightGray", dark: "darkGray" }),
  },
  primaryColor: "accent",
  primaryShade: { light: 6, dark: 4 },
  autoContrast: true,
  fontFamily: "var(--pi-font-ui)",
  fontFamilyMonospace: "var(--pi-font-mono)",
  headings: { fontFamily: "var(--pi-font-ui)", fontWeight: "600" },
  defaultRadius: "md",
  radius: { xs: "4px", sm: "8px", md: "10px", lg: "14px", xl: "999px" },
  cursorType: "pointer",
  components: {
    // One look for every banner and inline notice: a light tint of the semantic colour (red / yellow / gray / blue)
    // instead of Mantine 9's solid dark fill for `light` in dark mode. The tint is translucent, so a floating banner
    // sits on a Paper (see SessionBanners in App.jsx).
    Alert: Alert.extend({
      defaultProps: { variant: "light", radius: "md" },
      vars: (theme, { color }) => {
        const { variable } = parseThemeColor({ color: color || theme.primaryColor, theme });
        return { root: {
          "--alert-bg": `color-mix(in srgb, var(${variable}) 14%, transparent)`,
          "--alert-bd": `1px solid color-mix(in srgb, var(${variable}) 32%, transparent)`,
        } };
      },
    }),
    // Every two-state switch is the tool list's three-way pill without its middle stop (design-system/switch): same
    // track and knob size whatever `size` a page passes, grey / green, ○ / ● in the knob.
    Switch: Switch.extend({
      // Mantine's own thumb indicator would draw a second, filled dot under our ○ / ●.
      defaultProps: { withThumbIndicator: false },
      classNames: { track: "prk-pill-track", thumb: "prk-pill-knob" },
      vars: () => ({ root: { "--switch-height": "var(--pill-h)", "--switch-width": "var(--pill-w)", "--switch-thumb-size": "var(--pill-knob)", "--switch-track-label-padding": "var(--pill-pad)" } }),
    }),
  },
});

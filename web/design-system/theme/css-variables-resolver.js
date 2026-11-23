import { palette } from "../../../shared/palette.js";
export const schemeVariables = (tokens) => ({
  ...Object.fromEntries(Object.entries(tokens).map(([name, value]) => [`--pi-${name}`, value])),
  "--mantine-color-body": "var(--pi-bg)",
  "--mantine-color-text": "var(--pi-ink)",
  "--mantine-color-dimmed": "var(--pi-muted)",
  "--mantine-color-default": "var(--pi-surface)",
  "--mantine-color-default-hover": "var(--pi-surface-2)",
  "--mantine-color-default-border": "var(--pi-line-strong)",
  "--mantine-color-placeholder": "var(--pi-faint)",
  "--mantine-color-anchor": "var(--pi-accent-strong)",
});

export const cssVariablesResolver = () => ({
  variables: {},
  light: schemeVariables(palette.light.tokens),
  dark: schemeVariables(palette.dark.tokens),
});


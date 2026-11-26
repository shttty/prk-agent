/** One scheme's CSS variables: every palette token as --pi-<name>, and Mantine's neutral colours pointed at them. */
export function schemeVariables(tokens: Record<string, string>): Record<string, string> {
  return {
    ...Object.fromEntries(Object.entries(tokens).map(([name, value]) => [`--pi-${name}`, value])),
    "--mantine-color-body": "var(--pi-bg)",
    "--mantine-color-text": "var(--pi-ink)",
    "--mantine-color-dimmed": "var(--pi-muted)",
    "--mantine-color-default": "var(--pi-surface)",
    "--mantine-color-default-hover": "var(--pi-surface-2)",
    "--mantine-color-default-border": "var(--pi-line-strong)",
    "--mantine-color-placeholder": "var(--pi-faint)",
    "--mantine-color-anchor": "var(--pi-accent-strong)",
  };
}

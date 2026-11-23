import { Loader } from "@mantine/core";
import { Badge } from "@mantine/core";
export const COLORS = { ok: "var(--pi-ok)", error: "var(--pi-danger)", warn: "var(--pi-warn)", idle: "var(--pi-faint)", sleep: "var(--pi-warn)" };

export default function StatusDot({ tone, size = 8, ...props }) {
  if (tone === "run") return <Loader type="oval" size={size + 2} color="var(--pi-accent)" data-tone="run" aria-hidden="true" {...props} />;
  return <Badge circle p={0} size={size} variant={tone === "idle" || tone === "sleep" ? "outline" : "filled"} color={COLORS[tone] ?? COLORS.idle} data-tone={tone} aria-hidden="true" {...props} />;
}


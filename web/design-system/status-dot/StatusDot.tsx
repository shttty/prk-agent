import { Badge, Loader } from "@mantine/core";

type StatusTone = "ok" | "error" | "warn" | "idle" | "sleep" | "run";
type StatusDotProps = { tone: StatusTone; size?: number; className?: string };

const COLORS: Record<Exclude<StatusTone, "run">, string> = { ok: "var(--pi-ok)", error: "var(--pi-danger)", warn: "var(--pi-warn)", idle: "var(--pi-faint)", sleep: "var(--pi-warn)" };

export default function StatusDot({ tone, size = 8, ...props }: StatusDotProps) {
  if (tone === "run") return <Loader type="oval" size={size + 2} color="var(--pi-accent)" data-tone="run" aria-hidden="true" {...props} />;
  return <Badge circle p={0} size={`${size}px`} variant={tone === "idle" || tone === "sleep" ? "outline" : "filled"} color={COLORS[tone] ?? COLORS.idle} data-tone={tone} aria-hidden="true" {...props} />;
}

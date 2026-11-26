import { Switch, type SwitchProps } from "@mantine/core";
import "./pill-switch.css";

/**
 * PRK two-state pill switch (design system): grey (off) / green (on), ○ / ● in the knob — the three-way PrkTriSwitch
 * without its middle stop. Takes Mantine Switch props (checked, onChange, label, description, disabled, aria-label…);
 * the skin and size are fixed by the theme (mantine-theme.ts Switch.extend), which also covers any plain Mantine Switch.
 */
export function PrkSwitch(props: SwitchProps) {
  return <Switch {...props} />;
}

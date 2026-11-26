import type { MantineThemeComponents } from "@mantine/core";
import { motionMs } from "../motion/motion-ms.ts";
import type { MotionDuration } from "../motion/motion-types.ts";

/** Floating layers settle a few px down from where they open and fade, on the --pi-motion-* timing. Only transform and
 * opacity move; nothing scales, so icons inside never grow or shrink. */
const settle = {
  in: { opacity: 1, transform: "translateY(0)" },
  out: { opacity: 0, transform: "translateY(calc(var(--pi-motion-rise) / -2))" },
  transitionProperty: "opacity, transform",
};

/** Mantine component defaults for menus, popovers, tooltips, modals, drawers and accordions, built when the theme is
 * (tokens.css is loaded by then). Mantine needs plain ms: it also times the unmount with it. Select/Combobox lists stay
 * instant (Mantine's 0 ms): they are typed into and read at once, a list fading in under the keyboard only slows it. */
export function motionComponents(noAnimation: boolean): MantineThemeComponents {
  const duration = (name: MotionDuration) => noAnimation ? 0 : motionMs(name);
  const overlay = { transition: settle, duration: duration("fast"), exitDuration: duration("instant"), timingFunction: "var(--pi-motion-ease-out)" };
  return {
    Popover: { defaultProps: { transitionProps: overlay } },
    Menu: { defaultProps: { transitionProps: overlay } },
    Tooltip: { defaultProps: { transitionProps: { ...overlay, transition: "fade" } } },
    Modal: { defaultProps: { transitionProps: { duration: duration("base"), exitDuration: duration("instant"), timingFunction: "var(--pi-motion-ease-out)" } } },
    Drawer: { defaultProps: { transitionProps: { duration: duration("base"), exitDuration: duration("fast"), timingFunction: "var(--pi-motion-ease-out)" } } },
    Accordion: { defaultProps: { transitionDuration: duration("slow") } },
  };
}

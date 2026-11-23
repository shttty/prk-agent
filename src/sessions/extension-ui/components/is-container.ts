import type { Component } from "@earendil-works/pi-tui";

export function isContainer(component: Component): component is Component & { children: Component[] } {
  return "children" in component && Array.isArray((component as Component & { children?: unknown }).children);
}

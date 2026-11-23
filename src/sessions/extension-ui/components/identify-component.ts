import type { Component } from "@earendil-works/pi-tui";

export function componentName(component: Component): string {
  return component.constructor?.name || "Component";
}

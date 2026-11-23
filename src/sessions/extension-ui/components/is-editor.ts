import type { RuntimeEditor } from "../ui-types.ts";
import type { Component } from "@earendil-works/pi-tui";

export function isEditor(component: Component): component is RuntimeEditor {
  return "getText" in component && typeof component.getText === "function" && "setText" in component && typeof component.setText === "function";
}

import type { Component } from "@earendil-works/pi-tui";
import { isContainer } from "./is-container.ts";

export function containsComponent(root: Component, target: Component): boolean {
  if (root === target) return true;
  if (isContainer(root)) for (const child of root.children) if (containsComponent(child, target)) return true;
  return false;
}

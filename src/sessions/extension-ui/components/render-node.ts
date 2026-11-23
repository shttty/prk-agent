import type { UiContext, HostedNode, RuntimeSelectList, RuntimeSettingsList, RuntimeInput } from "../ui-types.ts";
import type { Component } from "@earendil-works/pi-tui";
import { componentName } from "./identify-component.ts";
import { isContainer } from "./is-container.ts";
import { directionFor } from "./direction-for.ts";
import { isEditor } from "./is-editor.ts";
import { renderError } from "../describe-render-error.ts";

export function renderNode(ctx: UiContext, component: Component, width: number, nodes: Map<string, Component>, prefix: string): HostedNode {
    let componentId = ctx.componentIds.get(component);
    if (componentId === undefined) { componentId = ++ctx.sequence; ctx.componentIds.set(component, componentId); }
    const id = `${componentId}:${prefix}`;
    nodes.set(id, component);
    const name = componentName(component);
    if (name === "SelectList") {
      const select = component as RuntimeSelectList;
      return { id, kind: "select", selectedIndex: select.selectedIndex, value: select.getSelectedItem()?.value, options: select.filteredItems.map((item) => ({ ...item })), submit: typeof select.onSelect === "function", cancel: typeof select.onCancel === "function" };
    }
    if (name === "SettingsList") {
      const settings = component as RuntimeSettingsList;
      const active = ctx.settingsSubmenus.get(settings);
      return { id, kind: "settings", items: settings.items.map((item) => ({ id: item.id, label: item.label, value: item.currentValue, options: item.values, description: item.description, submenu: typeof item.submenu === "function" })), ...(active?.component ? { submenu: renderNode(ctx, active.component, width, nodes, `${id}-submenu`) } : {}), submit: false, cancel: active !== undefined || typeof settings.onCancel === "function" };
    }
    if (isEditor(component)) return { id, kind: "editor", value: component.getText(), submit: typeof component.onSubmit === "function", cancel: "onEscape" in component && typeof component.onEscape === "function" };
    if (name === "Input") {
      const input = component as RuntimeInput;
      return { id, kind: "input", value: input.getValue(), submit: typeof input.onSubmit === "function", cancel: typeof input.onEscape === "function" };
    }
    if (isContainer(component)) return { id, kind: "container", direction: directionFor(name), children: component.children.map((child, index) => renderNode(ctx, child, width, nodes, `${id}-${index}`)) };
    let lines: readonly string[];
    try { lines = component.render(Math.max(1, Math.floor(width))); } catch (error) { lines = [`[extension component render failed: ${renderError(error)}]`]; }
    const opaque = typeof component.handleInput === "function" || typeof component.handleMouse === "function";
    return { id, kind: "text", lines, ...(opaque ? { blocked: "Opaque interactive component: only cancellation is supported; raw key injection is unavailable." } : {}) };
  }

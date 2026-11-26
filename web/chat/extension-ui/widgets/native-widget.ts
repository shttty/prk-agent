import type { HostedNode } from "../../../../src/gateway/wire/web-types.ts";
import TodoDock from "./todo/TodoDock.tsx";
import { stripAnsi } from "../../ansi/strip-ansi.ts";
import { parseTodoWidget } from "./todo/parse-todo-widget.ts";
/** `{ widgetKey, parse, Component }`; `parse(lines)` → data or null (not the plugin's format); Component gets `{ data }`. */
export const PLUGIN_RENDERERS = [
  // prk-todolist: its todo widget (the text format is the plugin's docs/widget-format.md).
  { widgetKey: "prk-todolist.todo", parse: parseTodoWidget, Component: TodoDock },
];

/** The native renderer for a widget and its parsed data, or null when the widget shows the plugin's own content. */
export function nativeWidget(widgetKey: string, node: HostedNode | undefined) {
  const renderer = PLUGIN_RENDERERS.find((entry) => entry.widgetKey === widgetKey);
  if (!renderer || node?.kind !== "text" || !Array.isArray(node.lines)) return null;
  const data = renderer.parse(node.lines.map(stripAnsi));
  return data ? { Component: renderer.Component, data } : null;
}

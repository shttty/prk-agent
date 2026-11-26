import type { CssVarStyle } from "../../../payload/css-var-style.ts";
import type { TodoItem as TodoItemData } from "./todo-types.ts";
import { StatusIcon } from "./StatusIcon.tsx";
const depthStyle = (depth: number): CssVarStyle => ({ "--pi-todo-depth": depth });

export function Item({ item, depth, current }: { item: TodoItemData; depth: number; current: TodoItemData | null }) {
  return <li data-kind={depth ? "subtask" : "task"} data-status={item.status} aria-current={item === current ? "step" : undefined} style={depth ? depthStyle(depth) : undefined}>
    <StatusIcon status={item.status} />
    <span className="pi-todo-text">{item.content}{item.reason ? <span className="pi-todo-reason">{item.reason}</span> : null}</span>
    {item.owner ? <span className="pi-todo-owner">{item.owner}</span> : null}
  </li>;
}

import { StatusIcon } from "./StatusIcon.jsx";
export function Item({ item, depth, current }) {
  return <li data-kind={depth ? "subtask" : "task"} data-status={item.status} aria-current={item === current ? "step" : undefined} style={depth ? { "--pi-todo-depth": depth } : undefined}>
    <StatusIcon status={item.status} />
    <span className="pi-todo-text">{item.content}{item.reason ? <span className="pi-todo-reason">{item.reason}</span> : null}</span>
    {item.owner ? <span className="pi-todo-owner">{item.owner}</span> : null}
  </li>;
}

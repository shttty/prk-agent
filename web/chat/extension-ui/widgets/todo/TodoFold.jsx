import { StatusIcon } from "./StatusIcon.jsx";
export function Fold({ count }) {
  return <li data-kind="fold" data-count={count}><StatusIcon status="completed" /><span className="pi-todo-text">{count} 项已完成</span></li>;
}

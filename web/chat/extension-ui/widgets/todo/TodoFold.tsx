import { StatusIcon } from "./StatusIcon.tsx";
export function Fold({ count }: { count: number }) {
  return <li data-kind="fold" data-count={count}><StatusIcon status="completed" /><span className="pi-todo-text">{count} 项已完成</span></li>;
}

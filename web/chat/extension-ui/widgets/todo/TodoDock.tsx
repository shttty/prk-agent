import "./todo.css";
import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import { IconChevronUp } from "@tabler/icons-react";
import type { TodoData } from "./todo-types.ts";
import { StatusIcon } from "./StatusIcon.tsx";
import { flatten } from "./flatten.ts";
import { barStatuses } from "./bar-statuses.ts";
import { Item } from "./TodoItem.tsx";
import { Fold } from "./TodoFold.tsx";
/** `data`: `parseTodoWidget`'s result. */
export default function TodoDock({ data }: { data: TodoData }) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false); // the open list is scrolled short of its end: the CSS fades its bottom
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const update = () => setMore(list.scrollHeight - list.scrollTop - list.clientHeight > 1);
    update();
    list.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(list);
    return () => { list.removeEventListener("scroll", update); resize.disconnect(); };
  }, [open, data]);
  const { done, total, phases } = data;
  const items = flatten(phases);
  const running = items.filter((item) => item.status === "in_progress");
  const current = running[0] || items.find((item) => item.status === "blocked") || items.find((item) => item.status === "pending") || null;
  return <section id="todo-dock" className="pi-todo" data-open={open ? "true" : undefined} data-count={total} data-done={done} aria-label="任务清单">
    {open ? <ol id="todo-list" ref={listRef} className="pi-todo-list" data-more={more ? "true" : undefined}>
      {phases.map((phase, index) => [
        phase.name !== null ? <li key={`p${index}`} data-kind="phase" data-collapsed={phase.collapsed ? "true" : undefined} data-active={phase.active ? "true" : undefined} data-done={phase.done} data-total={phase.total}>
          <span><b>{phase.numeral}.</b> {phase.name}</span>
          <span className="pi-todo-phase-count">{phase.done}/{phase.total}</span>
        </li> : null,
        ...phase.tasks.flatMap((task, at) => [
          phase.folded && at === phase.foldAt ? <Fold key={`f${index}`} count={phase.folded} /> : null,
          <Item key={`t${index}.${at}`} item={task} depth={0} current={current} />,
          ...task.subtasks.map((sub, subAt) => <Item key={`t${index}.${at}.${subAt}`} item={sub} depth={1} current={current} />),
        ]),
        phase.folded && phase.foldAt >= phase.tasks.length ? <Fold key={`f${index}`} count={phase.folded} /> : null,
      ])}
    </ol> : null}
    <button id="todo-toggle" type="button" className="pi-todo-head" aria-expanded={open} aria-controls={open ? "todo-list" : undefined} onClick={() => setOpen((value) => !value)}>
      <span className="pi-todo-count"><b>{done}</b>/{total}</span>
      <span className="pi-todo-bar" aria-hidden="true">{barStatuses(data).map((status, index) => <i key={index} data-status={status} />)}</span>
      {current
        ? <span className="pi-todo-current" data-status={current.status}><StatusIcon status={current.status} /><span>{current.content}</span>{running.length > 1 ? <span className="pi-todo-more" data-count={running.length - 1}>+{running.length - 1}</span> : null}</span>
        : <span className="pi-todo-current" data-status="completed"><StatusIcon status="completed" /><span>全部完成</span></span>}
      <IconChevronUp className="pi-todo-caret" size={15} stroke={1.8} aria-hidden="true" />
    </button>
  </section>;
}

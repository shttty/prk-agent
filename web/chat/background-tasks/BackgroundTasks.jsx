import "../extension-ui/widgets/todo/todo.css";
import "./background-tasks.css";
import { useContext, useState } from "react";
import { IconChevronUp } from "@tabler/icons-react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { WorkbenchContext } from "../../workbench/subscription/workbench-context.js";
import { cellStopKey } from "../../workbench/store/messages/cell-stop-key.js";
import { formatElapsed } from "../transcript/tool-calls/format-elapsed.js";
import { useTicker } from "../transcript/tool-calls/use-ticker.js";
import { interruptTerminal } from "../../workspace/terminal/interrupt-terminal.js";
import { backgroundTasks } from "./background-tasks.js";
import { readFoldPreference, saveFoldPreference } from "./fold-preference.js";
import { taskElapsed } from "./task-elapsed.js";
import { BackgroundTaskRow } from "./BackgroundTaskRow.jsx";

const NO_CELLS = [];

export function BackgroundTasks({ sessionId, actions, onViewTerminal, onRevealKernel }) {
  const store = useContext(WorkbenchContext);
  const streamId = useWorkbench((state) => state.session.streamId);
  const cells = useWorkbench((state) => state.session.snapshot?.sessionId === sessionId ? state.session.snapshot.kernel?.activeCells ?? NO_CELLS : NO_CELLS);
  const terminals = useWorkbench((state) => state.session.snapshot?.sessionId === sessionId ? state.session.snapshot.terminals : null);
  const prompts = useWorkbench((state) => state.session.extensionUi?.prompts);
  const connected = useWorkbench((state) => state.session.connection === "connected");
  const pending = useWorkbench((state) => state.session.pending);
  const [open, setOpen] = useState(() => readFoldPreference(sessionId));
  const tasks = backgroundTasks(cells, terminals);
  const now = useTicker(tasks.some((task) => !task.waitingForAsk));
  if (!tasks.length) return null;
  const toggle = () => { saveFoldPreference(sessionId, !open); setOpen(!open); };
  const askId = (task) => prompts?.find((prompt) => prompt.kind === "ask" && prompt.cellId === task.cellId && prompt.kernelId === task.kernelId)?.id;
  const view = (event, task) => {
    if (task.kind === "terminal") { onViewTerminal(sessionId, task); return; }
    if (!task.waitingForAsk) { onRevealKernel(event, { ...task, sessionId }); return; }
    const ask = askId(task);
    const card = ask && document.querySelector(`[data-ask-id="${CSS.escape(ask)}"]`);
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({ block: "nearest" });
  };
  const interrupt = (task) => {
    if (task.kind === "kernel") {
      void actions.cancelOperation({ sessionId, streamId, cellOnly: true, cell: { kernelId: task.kernelId, cellId: task.cellId } });
      return;
    }
    const isCurrent = () => {
      const state = store.getSnapshot();
      return state.selectedSessionId === sessionId && state.session.streamId === streamId && state.session.connection === "connected"
        && state.session.snapshot?.terminals?.some((terminal) => terminal.name === task.name && terminal.generation === task.generation && terminal.runningCommand?.id === task.commandId);
    };
    interruptTerminal(actions.api, sessionId, task, isCurrent, () => actions.setNotice("终端中断请求失败。", "warning"));
  };
  // A stop is pending per cell identity; a stopping or freezing cell keeps its row but needs no second request.
  const canInterrupt = (task) => connected && (task.kind !== "kernel" || (task.status === "running" && !pending.has(cellStopKey(task))));
  const first = tasks[0];
  const elapsed = (task) => taskElapsed(task, now);
  return <section id="background-tasks" className="pi-todo pi-background-tasks" data-open={open ? "true" : undefined} data-count={tasks.length} aria-label="后台任务">
    {open && <ol id="background-task-list" className="pi-todo-list">
      {tasks.map((task) => <BackgroundTaskRow key={`${task.kind}:${task.key}`} task={task} elapsed={elapsed(task)}
        canView={!task.waitingForAsk || Boolean(askId(task))} canInterrupt={canInterrupt(task)}
        onView={(event) => view(event, task)} onInterrupt={() => interrupt(task)} />)}
    </ol>}
    <button id="background-tasks-toggle" type="button" className="pi-todo-head" aria-expanded={open} aria-controls={open ? "background-task-list" : undefined} onClick={toggle}>
      <span className="pi-todo-count">后台 <b>{tasks.length}</b> 个运行中</span>
      {!open && <>
        <span aria-hidden="true">·</span>
        <span className="pi-background-task-name" title={first.displayName}>{first.waitingForAsk ? "等待回答" : first.displayName}</span>
        <span aria-hidden="true">·</span>
        <span className="pi-background-task-time" data-elapsed-ms={elapsed(first)}>{formatElapsed(elapsed(first))}</span>
      </>}
      <IconChevronUp className="pi-todo-caret" size={15} stroke={1.8} aria-hidden="true" />
    </button>
  </section>;
}

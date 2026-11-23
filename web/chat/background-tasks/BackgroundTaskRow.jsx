import { Button } from "@mantine/core";
import { IconBrandPython, IconBrandTypescript, IconTerminal2 } from "@tabler/icons-react";
import { formatElapsed } from "../transcript/tool-calls/format-elapsed.js";
import { stopEvidence } from "./stop-evidence.js";

const STEP_LABELS = { timer: "定时等待", socket: "网络等待", child: "子进程", task: "异步任务", inject: "中断投递", syscall: "系统调用", parameters: "调用参数", trace: "检查点", isolated: "隔离进程" };

/** One expanded row: name, mode, elapsed, where a stopping cell is held, view and interrupt. */
export function BackgroundTaskRow({ task, elapsed, canView, canInterrupt, onView, onInterrupt }) {
  const Icon = task.kind === "terminal" ? IconTerminal2 : task.language === "bun" ? IconBrandTypescript : IconBrandPython;
  const held = task.kind === "kernel" ? stopEvidence(task) : null;
  const stopping = task.status === "stopping";
  return <li data-task-kind={task.kind} data-task-id={task.id} data-task-name={task.displayName}
    data-kernel-id={task.kernelId} data-cell-id={task.cellId} data-waiting-ask={task.waitingForAsk ? "true" : undefined}
    data-status={task.kind === "kernel" ? task.status : "running"} data-mode={task.mode} data-language={task.language}
    data-blocked-step={held?.latest.step} data-blocked-status={held?.latest.status} data-timer-remaining-ms={held?.timerMs}>
    <Icon className="pi-todo-icon" data-status={stopping ? "blocked" : "in_progress"} size={16} aria-hidden="true" />
    <span className="pi-background-task-text">
      <span className="pi-background-task-name" title={task.displayName}>{task.waitingForAsk ? "等待回答" : task.displayName}</span>
      {stopping ? <span className="pi-todo-reason pi-background-task-held" title={held?.steps.map((step) => `${step.step}/${step.status}: ${step.evidence}`).join("\n")}>
        停止中{held ? ` · ${STEP_LABELS[held.latest.step] ?? held.latest.step}` : ""}{held?.timerMs !== undefined ? ` ≤ ${formatElapsed(held.timerMs)}` : ""}
      </span> : null}
    </span>
    {task.mode ? <span className="pi-todo-owner pi-background-task-mode">{task.mode}</span> : null}
    <span className="pi-background-task-time" data-elapsed-ms={elapsed}>{formatElapsed(elapsed)}</span>
    <Button size="compact-xs" variant="subtle" color="gray" data-action="view" disabled={!canView} onClick={onView}>查看</Button>
    <Button size="compact-xs" variant="subtle" color="gray" data-action="interrupt" disabled={!canInterrupt} onClick={onInterrupt}>中断</Button>
  </li>;
}

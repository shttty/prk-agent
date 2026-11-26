import { FOLD, HEADER, TITLE } from "./parse-todo-constants.ts";
import { isClosed } from "./is-closed.ts";
import { parseTodoItem } from "./parse-todo-item.ts";
import { roman } from "./roman.ts";
import type { TodoData, TodoItem, TodoPhase } from "./todo-types.ts";

// Parser for the todo plugin's widget text. The contract is the plugin's docs/widget-format.md (repo
// prk-todolist); keep its emitted format and this parser aligned.
// Input: the widget's plain-text lines (ANSI already stripped; colours are never read).
//
//   Todo 2/5                      header: closed/total of tasks (closed = completed + cancelled)
//   I. 调研  2/2                  phase: ROMAN. name, TWO spaces, closed/total; all closed = header only (folded phase)
//   II. 实现  0/3
//     ▸ 写解析器  · session-a      task: symbol, content, optional owner after the FIRST run of two spaces, as `· owner`
//       ✓ 状态行                  subtask: two more indent
//     ! 接入浮窗                  blocked: the NEXT line, item indent + 2, is its reason (whatever it starts with)
//       等 Gateway 重启
//     ✓ 3 completed               fold of that scope's completed tasks (and their subtasks), where the first stood
//
// Indent is ONE rule per list: with any phase line in it tasks are at 2 and subtasks at 4 (unphased tasks before the
// first phase line too), without phases 0 and 2.
//
// Result: { done, total, phases: [{ numeral, name, done, total, collapsed, active, folded, foldAt, tasks }] }.
// Tasks of no phase form a group with `name: null, numeral: null` (the whole list when there are no phases), first.
// `tasks`: [{ status, content, owner?, reason?, subtasks }] (a subtask has `subtasks: []`). `folded`: how many completed
// tasks the fold line replaced (0 = no fold; per scope, which replaces a whole-list count), `foldAt`: the index in
// `tasks` it stands before. `collapsed`: a phase drawn as its header only. `active`: a TASK of the phase is in
// progress (subtasks do not count, as in the TUI).
// Any line outside the grammar, or counts that do not add up, make the whole result null (the caller shows the
// plugin's own text).

/** The parsed todo list for the widget's plain-text lines, or null when any line is not the plugin's grammar. */
export function parseTodoWidget(lines: readonly string[]): TodoData | null {
  const title = TITLE.exec(lines[0]?.trimEnd() ?? "");
  if (!title) return null;
  const body = lines.slice(1).map((line) => line.trimEnd());
  const taskIndent = body.some((line) => HEADER.test(line)) ? 2 : 0;
  const group = (numeral: string | null, name: string | null, done: number, total: number): TodoPhase => ({ numeral, name, done, total, collapsed: false, active: false, folded: 0, foldAt: 0, tasks: [] });
  const phases: TodoPhase[] = [];
  let current: TodoPhase | null = null; // the group lines attach to; the unphased one is made by its first line
  let task: TodoItem | null = null; // last top-level task: subtasks attach to it
  let reasonFor: { item: TodoItem; indent: number } | null = null;
  const into = (): TodoPhase => {
    if (current) return current;
    const created = group(null, null, 0, 0);
    phases.push(created);
    current = created;
    return created;
  };
  for (const line of body) {
    const indent = line.length - line.trimStart().length;
    const text = line.slice(indent);
    if (reasonFor) {
      if (indent !== reasonFor.indent + 2 || !text) return null;
      reasonFor.item.reason = text;
      reasonFor = null;
      continue;
    }
    if (!text) return null;
    const header = indent === 0 ? HEADER.exec(text) : null;
    if (header) {
      if (header[1] !== roman(phases.filter((phase) => phase.name !== null).length + 1) || Number(header[3]) > Number(header[4])) return null;
      current = group(header[1] ?? null, header[2] ?? null, Number(header[3]), Number(header[4]));
      phases.push(current);
      task = null;
      continue;
    }
    const fold = indent === taskIndent ? FOLD.exec(text) : null;
    if (fold) {
      const scope = into();
      if (scope.folded || !Number(fold[1])) return null;
      scope.folded = Number(fold[1]);
      scope.foldAt = scope.tasks.length;
      task = null;
      continue;
    }
    const isTask = indent === taskIndent;
    if (!isTask && !(task && indent === taskIndent + 2)) return null;
    const entry = parseTodoItem(text);
    if (!entry) return null;
    if (isTask) {
      into().tasks.push(entry);
      task = entry;
    } else task?.subtasks.push(entry);
    if (entry.status === "blocked") reasonFor = { item: entry, indent };
  }
  if (reasonFor) return null;
  let done = 0;
  let total = 0;
  for (const phase of phases) {
    const shown = phase.tasks.length + phase.folded;
    const shownClosed = phase.tasks.filter(isClosed).length + phase.folded;
    if (phase.name === null) [phase.done, phase.total] = [shownClosed, shown];
    else if (!shown) { // header only: nothing listed, so every task of it is closed
      if (phase.done !== phase.total) return null;
      phase.collapsed = true;
    } else if (phase.done !== shownClosed || phase.total !== shown) return null;
    phase.active = phase.tasks.some((entry) => entry.status === "in_progress");
    done += phase.done;
    total += phase.total;
  }
  return done === Number(title[1]) && total === Number(title[2]) ? { done, total, phases } : null;
}

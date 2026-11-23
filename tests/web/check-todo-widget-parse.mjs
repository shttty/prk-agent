// Todo widget parser (web/chat/todo-widget-parse.js), the web's side of the plugin's text format.
// tests/fixtures/todo-widget-samples.json is an exact copy of tests/fixtures/widget-samples.json from the plugin repo
// (the prk-todolist plugin repo; widget format baseline 6e3abaa; contract: its docs/widget-format.md).
// Re-copy it, with the new commit noted here, whenever the format changes. Each sample pairs a todo list with the
// widget lines the plugin renders for it; the parse of `lines` is checked against what `todos` says it must be.
// Bad input must give null.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTodoWidget } from "../../web/chat/extension-ui/widgets/todo/parse-todo-widget.js";

const samples = JSON.parse(readFileSync(new URL("../fixtures/todo-widget-samples.json", import.meta.url), "utf8"));
assert.equal(samples.length, 15, "all plugin samples present");

const FOLD_AT = 3; // the plugin's default PRK_TODOLIST_COLLAPSE_COMPLETED; the samples are rendered with it
const roman = (n) => { let out = ""; for (const [v, s] of [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]) while (n >= v) { out += s; n -= v; } return out; };
const oneLine = (text) => text.replace(/\s+/g, " ").trim();
const closed = (task) => task.status === "completed" || task.status === "cancelled";

/** The parse a sample's `todos` demand: phases in order after the unphased group, folds per scope, folded phases header only. */
function expected(todos) {
  const children = (parent) => todos.filter((todo) => todo.kind !== "phase" && todo.parent === parent);
  const entry = (todo) => ({ status: todo.status, content: oneLine(todo.content), ...(todo.owner ? { owner: oneLine(todo.owner) } : {}), ...(todo.reason ? { reason: oneLine(todo.reason) } : {}) });
  const group = (name, numeral, scope) => {
    const completed = scope.filter((task) => task.status === "completed").length;
    const collapsed = name !== null && scope.every(closed);
    const fold = !collapsed && completed >= FOLD_AT;
    const tasks = [];
    let foldAt = null;
    for (const task of scope) {
      if (collapsed) break;
      if (fold && task.status === "completed") { foldAt ??= tasks.length; continue; }
      tasks.push({ ...entry(task), subtasks: children(task.id).map((sub) => ({ ...entry(sub), subtasks: [] })) });
    }
    return { numeral, name, done: scope.filter(closed).length, total: scope.length, collapsed, active: scope.some((task) => task.status === "in_progress"), folded: fold ? completed : 0, foldAt: foldAt ?? 0, tasks };
  };
  const loose = children(undefined);
  const phases = todos.filter((todo) => todo.kind === "phase").map((todo, index) => group(oneLine(todo.content), roman(index + 1), children(todo.id)));
  const all = [...loose, ...phases.flatMap((_, index) => children(todos.filter((todo) => todo.kind === "phase")[index].id))];
  return { done: all.filter(closed).length, total: all.length, phases: [...(loose.length ? [group(null, null, loose)] : []), ...phases] };
}
for (const sample of samples) assert.deepEqual(parseTodoWidget(sample.lines), expected(sample.todos), sample.name);

// The documented example, spelled out.
assert.deepEqual(parseTodoWidget(["Todo 2/5", "I. 调研  2/2", "II. 实现  0/3", "  ▸ 写解析器  · session-a", "    ✓ 状态行", "    ○ 层级", "  ! 接入浮窗", "    等 Gateway 重启", "  ○ 测试"]), {
  done: 2, total: 5, phases: [
    { numeral: "I", name: "调研", done: 2, total: 2, collapsed: true, active: false, folded: 0, foldAt: 0, tasks: [] },
    { numeral: "II", name: "实现", done: 0, total: 3, collapsed: false, active: true, folded: 0, foldAt: 0, tasks: [
      { status: "in_progress", content: "写解析器", owner: "session-a", subtasks: [{ status: "completed", content: "状态行", subtasks: [] }, { status: "pending", content: "层级", subtasks: [] }] },
      { status: "blocked", content: "接入浮窗", reason: "等 Gateway 重启", subtasks: [] },
      { status: "pending", content: "测试", subtasks: [] },
    ] },
  ],
});
// Fold position: where the first completed task stood.
assert.deepEqual(parseTodoWidget(["Todo 3/5", "○ a", "✓ 3 completed", "▸ b"]).phases[0], { numeral: null, name: null, done: 3, total: 5, collapsed: false, active: true, folded: 3, foldAt: 1, tasks: [
  { status: "pending", content: "a", subtasks: [] }, { status: "in_progress", content: "b", subtasks: [] },
] });
// The owner follows the FIRST double space as `· owner`; without one, ` · ` is content. The reason is never split.
assert.deepEqual(parseTodoWidget(["Todo 0/1", "○ a · b  · c d"]).phases[0].tasks[0], { status: "pending", content: "a · b", owner: "c d", subtasks: [] });
assert.deepEqual(parseTodoWidget(["Todo 0/1", "○ a · b"]).phases[0].tasks[0], { status: "pending", content: "a · b", subtasks: [] });
assert.equal(parseTodoWidget(["Todo 0/1", "! a", "  x · y"]).phases[0].tasks[0].reason, "x · y");

// Anything not in the grammar: the whole result is null.
const BAD = {
  "no title": ["○ a"],
  "title not first": ["○ a", "Todo 0/1"],
  "empty": [],
  "old title": ["Todo (0/1)", "○ a"],
  "unknown symbol": ["Todo 0/1", "? a"],
  "no space after symbol": ["Todo 0/1", "○a"],
  "empty content": ["Todo 0/1", "○ "],
  "blank line": ["Todo 0/2", "○ a", "", "○ b"],
  "odd indent": ["Todo 0/2", "○ a", " ○ b"],
  "garbage line": ["Todo 0/1", "○ a", "plain prose"],
  "subtask without task": ["Todo 0/1", "  ○ a"],
  "too deep": ["Todo 0/1", "○ a", "  ○ b", "    ○ c"],
  "unphased task at 0 in a phased list": ["Todo 0/2", "○ a", "I. P  0/1", "  ○ b"],
  "task indent 0 under a phase": ["Todo 0/1", "I. P  0/1", "○ a"],
  "header with one space": ["Todo 0/1", "I. P 0/1", "  ○ a"],
  "header not roman": ["Todo 0/1", "1. P  0/1", "  ○ a"],
  "header numeral out of order": ["Todo 0/0", "II. P  0/0"],
  "header counts exceed": ["Todo 0/0", "I. P  3/2"],
  "header counts disagree with the tasks": ["Todo 0/2", "I. P  0/2", "  ○ a"],
  "title counts disagree": ["Todo 0/3", "○ a", "○ b"],
  "open phase without task lines": ["Todo 0/1", "I. P  0/1"],
  "blocked without reason": ["Todo 0/1", "! a"],
  "blocked reason missing mid-list": ["Todo 0/2", "! a", "○ b"],
  "reason indent": ["Todo 0/1", "! a", "    why"],
  "double space then other text": ["Todo 0/1", "○ a  b"],
  "double space then bare dot": ["Todo 0/1", "○ a  ·"],
  "double space then dot and space": ["Todo 0/1", "○ a  · "],
  "double space then dot without space": ["Todo 0/1", "○ a  ·b"],
  "three spaces before the dot": ["Todo 0/1", "○ a   · b"],
  "second double space in the owner": ["Todo 0/1", "○ a  · b  c"],
  "empty content before the owner": ["Todo 0/1", "○   · b"],
  "subtask with double space and no owner": ["Todo 0/2", "○ a", "  ○ b  c"],
  "fold twice in a scope": ["Todo 2/3", "✓ 1 completed", "✓ 1 completed", "○ a"],
  "fold of zero": ["Todo 0/1", "✓ 0 completed", "○ a"],
  "subtask after a fold": ["Todo 3/3", "✓ 3 completed", "  ○ a"],
  "non-string": ["Todo 0/0", 5],
};
for (const [name, lines] of Object.entries(BAD)) assert.equal(parseTodoWidget(lines), null, `bad input: ${name}`);
assert.equal(parseTodoWidget(null), null);

console.log(`PASS todo widget parser: ${samples.length} shared samples, example, ${Object.keys(BAD).length} bad inputs`);

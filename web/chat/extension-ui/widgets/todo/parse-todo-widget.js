
// Parser for the todo plugin's widget text. The contract is the plugin's docs/widget-format.md (repo
// prk-todolist); a format change must land here and in tests/fixtures/todo-widget-samples.json together.
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

export const SYMBOLS = { "▸": "in_progress", "✓": "completed", "✕": "cancelled", "!": "blocked", "○": "pending" };

export const HEADER = /^([IVXLCDM]+)\. (.+) {2}(\d+)\/(\d+)$/;

export const FOLD = /^✓ (\d+) completed$/;

export const TITLE = /^Todo (\d+)\/(\d+)$/;

export const OWNER = "· ";

export const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];

export const roman = (n) => ROMAN.reduce(([rest, out], [value, symbol]) => [rest % value, out + symbol.repeat(Math.floor(rest / value))], [n, ""])[1];

export const closed = (task) => task.status === "completed" || task.status === "cancelled";

/** `{ status, content, owner?, reason?, subtasks }` for a task line's text (after the indent), or null. The plugin folds
 *  whitespace runs in content and owner, so the first two spaces after the symbol can only be the owner separator;
 *  what follows them must be exactly `· <owner>`. Without two spaces there is no owner and ` · ` stays content. */
export function item(text) {
  const status = SYMBOLS[text[0]];
  if (!status || text[1] !== " ") return null;
  const rest = text.slice(2);
  const cut = rest.indexOf("  ");
  const content = cut < 0 ? rest : rest.slice(0, cut);
  if (!content) return null;
  if (cut < 0) return { status, content, subtasks: [] };
  const tail = rest.slice(cut + 2);
  if (!tail.startsWith(OWNER) || tail.length === OWNER.length || tail.includes("  ")) return null;
  return { status, content, owner: tail.slice(OWNER.length), subtasks: [] };
}

/** The parsed todo list for the widget's plain-text lines, or null when any line is not the plugin's grammar. */
export function parseTodoWidget(lines) {
  if (!Array.isArray(lines) || !lines.every((line) => typeof line === "string")) return null;
  const title = TITLE.exec(lines[0]?.trimEnd() ?? "");
  if (!title) return null;
  const body = lines.slice(1).map((line) => line.trimEnd());
  const taskIndent = body.some((line) => HEADER.test(line)) ? 2 : 0;
  const group = (numeral, name, done, total) => ({ numeral, name, done, total, collapsed: false, active: false, folded: 0, foldAt: 0, tasks: [] });
  const phases = [];
  let current = null; // the group lines attach to; the unphased one is made by its first line
  let task = null; // last top-level task: subtasks attach to it
  let reasonFor = null;
  const into = () => current ?? (phases.push(current = group(null, null, 0, 0)), current);
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
      current = group(header[1], header[2], Number(header[3]), Number(header[4]));
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
    const entry = item(text);
    if (!entry) return null;
    if (isTask) {
      into().tasks.push(entry);
      task = entry;
    } else task.subtasks.push(entry);
    if (entry.status === "blocked") reasonFor = { item: entry, indent };
  }
  if (reasonFor) return null;
  let done = 0;
  let total = 0;
  for (const phase of phases) {
    const shown = phase.tasks.length + phase.folded;
    const shownClosed = phase.tasks.filter(closed).length + phase.folded;
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

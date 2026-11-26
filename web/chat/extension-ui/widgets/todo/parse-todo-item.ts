import { OWNER, SYMBOLS } from "./parse-todo-constants.ts";
import type { TodoItem } from "./todo-types.ts";

/** `{ status, content, owner?, reason?, subtasks }` for a task line's text (after the indent), or null. The plugin folds
 *  whitespace runs in content and owner, so the first two spaces after the symbol can only be the owner separator;
 *  what follows them must be exactly `· <owner>`. Without two spaces there is no owner and ` · ` stays content. */
export function parseTodoItem(text: string): TodoItem | null {
  const status = SYMBOLS[text[0] ?? ""];
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

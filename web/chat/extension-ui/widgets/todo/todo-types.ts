export type TodoStatus = "in_progress" | "completed" | "cancelled" | "blocked" | "pending";
export type TodoItem = { status: TodoStatus; content: string; owner?: string; reason?: string; subtasks: TodoItem[] };
export type TodoPhase = { numeral: string | null; name: string | null; done: number; total: number; collapsed: boolean; active: boolean; folded: number; foldAt: number; tasks: TodoItem[] };
export type TodoData = { done: number; total: number; phases: TodoPhase[] };

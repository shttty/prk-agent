import type { TodoItem } from "./todo-types.ts";

export const isClosed = (task: TodoItem) => task.status === "completed" || task.status === "cancelled";

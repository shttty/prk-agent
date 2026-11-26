import type { TodoStatus } from "./todo-types.ts";
import { ICONS } from "./todo-constants.ts";
export function StatusIcon({ status }: { status: TodoStatus }) {
  const Icon = ICONS[status];
  return <Icon className="pi-todo-icon" data-status={status} size={15} stroke={1.8} aria-hidden="true" />;
}

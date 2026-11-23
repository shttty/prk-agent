import { ICONS } from "./todo-constants.js";
export function StatusIcon({ status }) {
  const Icon = ICONS[status];
  return <Icon className="pi-todo-icon" data-status={status} size={15} stroke={1.8} aria-hidden="true" />;
}

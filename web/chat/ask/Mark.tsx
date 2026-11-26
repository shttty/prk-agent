import { IconCheck } from "@tabler/icons-react";
export function Mark({ multi, on }: { multi: boolean; on: boolean }) {
  return <span className="pi-ask-mark" data-multi={multi ? "true" : "false"} data-on={on ? "true" : "false"} aria-hidden="true">{on ? <IconCheck size={12} stroke={3} /> : null}</span>;
}

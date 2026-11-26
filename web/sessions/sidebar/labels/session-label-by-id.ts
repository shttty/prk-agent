import type { SessionRows } from "../../../workbench/store/store-types.ts";

export function sessionLabelById(sessions: SessionRows, id: string | null | undefined): string {
  const value = id?.trim();
  if (!value) return "—";
  return sessions.get(value)?.label.trim() || value;
}

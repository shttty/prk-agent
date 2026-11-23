import { text } from "../text.js";
export function sessionLabelById(sessions, id) {
  const value = text(id).trim();
  if (!value) return "—";
  return text(sessions.get(value)?.label).trim() || value;
}

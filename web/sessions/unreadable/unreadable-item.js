import { unreadableIdentity } from "./unreadable-identity.js";
const fileName = (file) => file.split(/[\\/]/).filter(Boolean).pop() || file;
/** A session list entry for an unreadable session: shaped for the instance/project grouping, never a sessionRow (not selectable, not in `state.sessions`). A row with no known name shows its file name; that is display only, not an id. */
export function unreadableItem(issue) {
  return { key: issue.key, sessionId: issue.sessionId, label: unreadableIdentity(issue) || fileName(issue.sessionFile), target: issue.target, state: "unreadable", unreadable: issue };
}

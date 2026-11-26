import type { UnreadableSession } from "../../workbench/payloads/payload-types.ts";
import type { UnreadableItem } from "../sidebar/sidebar-types.ts";
import { unreadableIdentity } from "./unreadable-identity.ts";

const fileName = (file: string) => file.split(/[\\/]/).filter(Boolean).pop() || file;

/** A session list entry for an unreadable session: shaped for the instance/project grouping, never a sessionRow (not selectable, not in `state.sessions`). A row with no known name shows its file name; that is display only, not an id. */
export function unreadableItem(issue: UnreadableSession): UnreadableItem {
  return { key: issue.key, sessionId: issue.sessionId, label: unreadableIdentity(issue) || fileName(issue.sessionFile), target: issue.target, state: "unreadable", unreadable: issue };
}

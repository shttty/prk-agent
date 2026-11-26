// Attributes that identify a live element (ids, test and action hooks). A copy that is only for the eye drops them, so
// the only element a selector finds is the live one, and the copy is never clickable or announced.
const IDENTITY = ["id", "data-session-id", "data-action", "data-toast-id", "data-child", "data-message-id", "data-tool-key", "for", "name"];

/** Remove the identifying attributes from `root` and everything inside it. */
export function stripIdentity(root: Element): void {
  for (const node of [root, ...root.querySelectorAll("*")]) for (const name of IDENTITY) node.removeAttribute(name);
}

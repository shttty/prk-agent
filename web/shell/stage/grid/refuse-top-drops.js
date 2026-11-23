import { chatGroup } from "./chat-group.js";

/** The chat keeps the top of the stage: a tab may dock left of, right of or under the chat and anywhere among the other
 * groups, but not above the chat nor along the stage's top edge. (Nothing drops INTO the chat: its group is locked.) */
export const refuseTopDrops = (api) => api.onWillShowOverlay((event) => {
  if (event.position !== "top") return;
  if (!event.group || event.kind === "edge" || event.edge || event.group === chatGroup(api)) event.preventDefault();
});

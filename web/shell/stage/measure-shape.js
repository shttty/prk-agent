import { chatGroup } from "./grid/chat-group.js";
import { cornerGroup } from "./grid/corner-group.js";

/** What the page needs to know of the chat's place in the stage: how many groups there are, the chat's width, and
 * whether its group holds the grid's top-right corner (maximized, or the corner leaf of the grid's tree), where the
 * stage's buttons go. Read from the grid's structure, so it holds whenever the layout settles. */
export function measureShape(api) {
  const chat = chatGroup(api);
  const corner = !chat || chat.api.isMaximized() || cornerGroup(api.toJSON().grid) === chat.id;
  return { groups: api.groups.length, chatWidth: Math.round(chat?.api.width ?? 0), chatCorner: corner };
}

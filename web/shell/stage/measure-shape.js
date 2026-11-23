import { chatGroup } from "./grid/chat-group.js";

/** What the page needs to know of the chat's place in the stage: how many groups there are, the chat's width, and
 * whether its group is under the stage's top-right corner (the floating control group then sits over the chat). */
export function measureShape(api, frame) {
  const chat = chatGroup(api);
  const box = frame?.getBoundingClientRect();
  const rect = chat?.element.getBoundingClientRect();
  const corner = !rect || !box || !rect.width || (rect.top - box.top < 12 && box.right - rect.right < 12);
  return { groups: api.groups.length, chatWidth: Math.round(chat?.api.width ?? 0), chatCorner: corner };
}

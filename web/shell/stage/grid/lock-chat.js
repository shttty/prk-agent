import { CHAT_VIEW_MIN } from "./stage-constants.js";
import { chatGroup } from "./chat-group.js";

/** The chat's group: no header (no tab, nothing to drag or close), nothing dropped into it (`locked`; its edges still
 * split), and a floor so the reading column stays usable. `locked` and the hidden header are saved with the grid; the
 * floor is not, so this runs after every load. */
export function lockChat(api) {
  const group = chatGroup(api);
  group.locked = true;
  group.header.hidden = true;
  group.api.setConstraints({ minimumWidth: CHAT_VIEW_MIN.width, minimumHeight: CHAT_VIEW_MIN.height });
}

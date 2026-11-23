import { CARD_GAP } from "./layout-table.js";
import { SESSION_MIN } from "./layout-table.js";
import { SESSION_MAX } from "./layout-table.js";
import { CHAT_MIN } from "./layout-table.js";

const clampTo = (value, min, max) => Math.round(Math.max(min, Math.min(max, value)));

/** Widths of the desktop row: the session sidebar (its saved width fitted, `sessionRange` for its handle) and the stage
 * beside it (`chat`: the stage's width, which the chat has to itself while nothing is docked beside it). The sidebar
 * leaves the stage at least the chat's minimum. The frame is the card gap at the right edge, plus one at the left while
 * the sidebar is folded. */
export function fitWidths({ total: row, session }) {
  const total = row - CARD_GAP * (session.open ? 1 : 2);
  const sessionMax = Math.max(SESSION_MIN, Math.min(SESSION_MAX, total - CHAT_MIN));
  const sessionWidth = session.open ? clampTo(session.width, SESSION_MIN, sessionMax) : 0;
  return { session: sessionWidth, sessionRange: [SESSION_MIN, sessionMax], chat: total - sessionWidth };
}

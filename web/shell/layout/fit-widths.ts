import { CARD_GAP } from "./layout-table.ts";
import { SESSION_MIN } from "./layout-table.ts";
import { SESSION_MAX } from "./layout-table.ts";
import { CHAT_MIN } from "./layout-table.ts";

const clampTo = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, value)));

/** Widths of the desktop row: the session sidebar (its saved width fitted, `sessionRange` for its handle) and the stage
 * beside it (`chat`: the stage's width, which the chat has to itself while nothing is docked beside it). The sidebar
 * leaves the stage at least the chat's minimum. The frame is the card gap at the right edge, plus one at the left while
 * the sidebar is folded. */
type FitInput = { total: number; session: { open: boolean; width: number } };

export function fitWidths({ total: row, session }: FitInput) {
  const total = row - CARD_GAP * (session.open ? 1 : 2);
  const sessionMax = Math.max(SESSION_MIN, Math.min(SESSION_MAX, total - CHAT_MIN));
  const sessionWidth = session.open ? clampTo(session.width, SESSION_MIN, sessionMax) : 0;
  return { session: sessionWidth, sessionRange: [SESSION_MIN, sessionMax] as const, chat: total - sessionWidth };
}

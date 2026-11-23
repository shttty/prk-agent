/** Visible stage cards tile the grid; the pinned directory is a separate column, never inside a workspace group. */
import assert from "node:assert/strict";
import { CARD_GAP, CHAT_MIN, TREE_MIN } from "../../../web/shell/layout/layout-table.js";

export async function widthsHold(ctx, page, label) {
  await page.waitForTimeout(300);
  const b = await ctx.boxes(page);
  ctx.near(b.stage.left + CARD_GAP / 2, b.side ? b.side.right : CARD_GAP, `${label}: stage starts at the sidebar or frame gap`);
  ctx.near(b.stage.right - CARD_GAP / 2, b.window - CARD_GAP, `${label}: stage ends at the frame gap`);
  assert.ok(b.chat.width >= CHAT_MIN - 1, `${label}: chat keeps its minimum (${b.chat.width})`);
  const cards = [b.chat, ...b.work].sort((a, c) => a.left - c.left);
  ctx.near(cards[0].left, b.grid.left + CARD_GAP / 2, `${label}: first card starts the grid`);
  ctx.near(cards.at(-1).right, b.grid.right - CARD_GAP / 2, `${label}: last card ends the grid`);
  for (let i = 1; i < cards.length; i += 1) ctx.near(cards[i - 1].right + CARD_GAP, cards[i].left, `${label}: one gap between cards`);
  if (b.tree) {
    assert.ok(b.tree.width >= TREE_MIN - 1, `${label}: directory keeps its minimum`);
    ctx.near(b.tree.left, b.grid.right + CARD_GAP / 2, `${label}: pinned directory sits outside the grid`);
    ctx.near(b.tree.right, b.stage.right - CARD_GAP / 2, `${label}: pinned directory ends at the stage edge`);
    assert.ok(b.treeChild, `${label}: the directory is a direct stage child`);
  }
  if (b.expand) assert.ok(b.expandHit, `${label}: the directory toggle is clickable`);
  return b;
}

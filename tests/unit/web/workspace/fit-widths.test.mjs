import assert from "node:assert/strict";
import { test } from "node:test";
import { fitWidths } from "../../../../web/shell/layout/fit-widths.js";
import { CARD_GAP, CHAT_MIN, SESSION_MAX, SESSION_MIN } from "../../../../web/shell/layout/layout-table.js";

test("the stage takes the row beside the session sidebar, inside the frame", () => {
  assert.deepEqual(fitWidths({ total: 1440, session: { open: true, width: 280 } }), { session: 280, sessionRange: [SESSION_MIN, SESSION_MAX], chat: 1440 - CARD_GAP - 280 });
  assert.equal(fitWidths({ total: 1440, session: { open: false, width: 280 } }).chat, 1440 - 2 * CARD_GAP, "a folded sidebar adds the left gap");
});

test("the session sidebar leaves the stage at least the chat's minimum", () => {
  for (const total of [700, 1024, 1440]) for (const width of [1, 280, 5000]) {
    const fit = fitWidths({ total, session: { open: true, width } });
    assert.ok(fit.session >= SESSION_MIN && fit.session <= fit.sessionRange[1], `${total}/${width}`);
    assert.equal(CARD_GAP + fit.session + fit.chat, total);
    if (total - CARD_GAP - SESSION_MIN >= CHAT_MIN) assert.ok(fit.chat >= CHAT_MIN, `${total}/${width}`);
  }
});

// The phone workspace overlay holds shells as tabs of its one tab strip: the new-terminal button adds one, a reload brings
// both back, and the overlay closes by its own button.
// Under the composer: one row, nothing cut off at the left; with only model/thinking/tool mode/context it fits 390px
    // without scrolling (R2). The session settings that used to sit there are not in it.
// Monitor sheet: nothing of the transcript between the top bar and the sheet, from its first frame on (R2).
// The file browser covers the top bar, so the reverse goes through the DOM click.
import assert from "node:assert/strict";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";

export async function checkKeyboardAndDock(ctx) {
await ctx.page.locator("#new-terminal").click();

await ctx.page.locator('.pi-tab[data-shell="shell-2"]').waitFor();

assert.equal(await ctx.page.locator('.dv-tab.dv-active-tab .pi-tab[data-shell="shell-2"]').count(), 1, `${ctx.scheme}: a new shell is the shown tab`);

await ctx.page.reload();

await ctx.page.locator("#open-sidebar").click();

await selectSession(ctx.page, "w1");

await ctx.dock.waitFor({ state: "visible" });

await ctx.page.locator(".pi-term .xterm").first().waitFor({ state: "attached" });

assert.equal(await ctx.page.locator('#workspace-pane .pi-tab[data-kind="terminal"]').count(), 2, `${ctx.scheme}: both shells come back after a reload`);

await assertUniqueIds(ctx.page, "phone terminal");

await ctx.shot("terminal-two-shells");

await ctx.page.locator("#toggle-workspace").click();

await ctx.dock.waitFor({ state: "hidden" });

const sheet = ctx.page.locator("#monitor-card");

const files = ctx.page.locator("#workspace-pane");

const meta = await ctx.page.evaluate(() => {
      const row = document.querySelector("#composer-meta");
      const left = row.getBoundingClientRect().left;
      const controls = [...row.children].map((node) => node.getBoundingClientRect()).filter((box) => box.width > 0 && box.height > 0);
      return { left, lefts: controls.map((box) => box.left), tops: controls.map((box) => Math.round(box.top + box.height / 2)), scroll: row.scrollWidth - row.clientWidth, moved: row.querySelectorAll("#queue-select, #chat-local-tools, #chat-delegation-select").length };
    });

assert.equal(new Set(meta.tops).size, 1, `${ctx.scheme}: the composer meta row is a single row (${meta.tops})`);

for (const left of meta.lefts) assert.ok(left >= meta.left - 0.5, `${ctx.scheme}: no meta control starts left of the row (${left} < ${meta.left})`);

assert.ok(meta.scroll <= 1, `${ctx.scheme}: the meta row fits 390px without sideways scrolling (${meta.scroll}px over)`);

assert.equal(meta.moved, 0, `${ctx.scheme}: send mode / local tools / delegation are session settings, not in the row`);

const transcriptAboveSheet = () => ctx.page.evaluate(() => {
      const bar = document.querySelector(".topbar").getBoundingClientRect();
      const card = document.querySelector(".pi-monitor-panel[data-mobile]").getBoundingClientRect();
      const hits = [];
      for (let y = Math.floor(bar.bottom); y <= Math.ceil(card.top) + 1; y += 1) for (let x = 12; x < innerWidth; x += 30) if (document.elementFromPoint(x, y)?.closest("#transcript")) hits.push(`${x},${y}`);
      return { hits, opaque: getComputedStyle(document.querySelector(".pi-monitor-panel[data-mobile]")).backgroundColor.startsWith("rgb(") };
    });

await ctx.page.evaluate(() => { const node = document.querySelector("#transcript"); node.scrollTop = node.scrollHeight / 2; });

await ctx.page.locator("#toggle-monitor").click();

await sheet.waitFor({ state: "visible" });

for (const moment of ["opening", "open"]) {
      if (moment === "open") await ctx.page.waitForTimeout(400);
      const probe = await transcriptAboveSheet();
      assert.deepEqual(probe.hits, [], `${ctx.scheme}: no transcript shows between the top bar and the monitor sheet (${moment})`);
      assert.equal(probe.opaque, true, `${ctx.scheme}: the monitor sheet is opaque (${moment})`);
    }

await ctx.shot("monitor");

await ctx.page.locator("#toggle-workspace").click();

await files.waitFor({ state: "visible" });

await sheet.waitFor({ state: "detached" });

await ctx.shot("files");

await ctx.page.locator("#toggle-monitor").evaluate((button) => button.click());

await sheet.waitFor({ state: "visible" });

await files.waitFor({ state: "hidden" });

assert.deepEqual(ctx.h.problems.filter((problem) => !problem.startsWith("download failed (font-family")), [], `${ctx.scheme}: page errors`);

await ctx.context.close();
}

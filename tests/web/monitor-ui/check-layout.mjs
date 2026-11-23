import assert from "node:assert/strict";
import { finishWorkbench as finish } from "./workbench/finish-workbench.mjs";
import { toggle } from "./panel/find-toggle.mjs";
import { assertPillLook } from "./panel/assert-pill-look.mjs";

export async function checkLayout(ctx) {
  const { open, step, SNAPSHOTS } = ctx;
  await step("the monitor button is the panel's anchor in the chat column: one button folded, the panel unfolds under it, four layouts", async () => {
    const messages = Array.from({ length: 24 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: [{ type: "text", text: `row ${index} `.repeat(40) }], timestamp: Date.now() - 60_000 + index, ...(index % 2 ? { stopReason: "stop" } : {}) }));
    const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, messages, messageEntryIds: messages.map((_, index) => `e${index}`) } };
    const geometry = (page) => page.evaluate(() => {
      const box = (selector) => document.querySelector(selector)?.getBoundingClientRect() ?? null;
      const hits = (selector, closest, fractions) => { const rect = document.querySelector(selector)?.getBoundingClientRect(); return rect ? fractions.map((fraction) => document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height * fraction)?.closest(closest) !== null) : []; };
      const style = getComputedStyle(document.documentElement);
      return { chat: box(".pi-chatcol"), button: box("#toggle-monitor"), panel: box(".pi-monitor-panel"), controls: box("#workspace-controls"), transcript: box("#transcript"), mode: document.querySelector(".pi-chatcol").dataset.monitor ?? null, inset: parseFloat(style.getPropertyValue("--pi-monitor-inset")), width: parseFloat(style.getPropertyValue("--pi-monitor-w")), buttonHits: hits("#toggle-monitor", "#toggle-monitor", [0.5]), panelHits: hits(".pi-monitor-panel", ".pi-monitor-panel", [0.2, 0.8]) };
    });
    const near = (a, b, label) => assert(Math.abs(a - b) <= 1.5, `${label} (${a} vs ${b})`);
    for (const [label, width, workspace, terminal] of [["wide", 2240, false, false], ["narrow", 1280, false, false], ["with workspace", 1440, true, false], ["with terminal", 1440, true, true]]) {
      const h = await open({ snapshots, viewport: { width, height: 900 }, terminals: terminal ? [{ name: "shell" }] : null, storage: { "pi.layout.monitorCollapsed": "true", "pi.layout.workspaceOpen": String(workspace) } });
      const { page } = h;
      await toggle(page).waitFor();
      if (workspace) await page.locator('#desktop-stage[data-open="true"]').waitFor();
      if (terminal) await page.locator(".pi-term .xterm").waitFor();
      await page.waitForTimeout(300);
      // Closed: the button alone, in the chat column, carrying the state; nothing in the control group, no second chip.
      assert.equal(await page.locator("#toggle-monitor").count(), 1, `${label}: one monitor button`);
      assert.equal(await page.locator("#workspace-controls #toggle-monitor").count(), 0, `${label}: not in the control group`);
      assert.equal(await page.locator(".pi-chatcol > #toggle-monitor").count(), 1, `${label}: a child of the chat column`);
      assert.equal(await page.locator(".pi-monitor-panel").count(), 0, `${label}: nothing unfolded`);
      assert.equal(await toggle(page).getAttribute("aria-pressed"), "false");
      assert.equal(await toggle(page).getAttribute("data-alert"), "true", `${label}: the alert state is on the button`);
      assert.equal(await toggle(page).getAttribute("data-delta"), "+12", `${label}: the change count is on the button`);
      assert.equal(await page.locator("#toggle-monitor .pi-monitor-pill-fact").count(), 2, `${label}: CPU and memory numbers`);
      assert.equal(await page.locator("#toggle-monitor .pi-monitor-dot").count(), 1);
      const closed = await geometry(page);
      assert.equal(closed.mode, "chip", `${label}: closed`);
      assert(closed.button.left >= closed.chat.left && closed.button.right <= closed.chat.right && closed.button.top >= closed.chat.top, `${label}: the button is inside the chat column`);
      assert(closed.button.bottom <= closed.transcript.top + 0.5, `${label}: the button is above the transcript, covering no chat content`);
      const overChat = Boolean(closed.controls) && closed.controls.left < closed.chat.right;
      if (overChat) {
        const gap = closed.controls.left - closed.button.right;
        assert(gap >= 4 && gap <= 10, `${label}: the button sits an icon gap from the control group (${gap}px)`);
      }
      await assertPillLook(page, label);
      assert.deepEqual(closed.buttonHits, [true], `${label}: the button is what a click at its centre hits`);
      // Unfolded by the button: the panel is where it was before it hung under the toolbar, and the button stays its anchor.
      await toggle(page).click();
      await page.locator("#monitor-card").waitFor();
      await page.waitForTimeout(300);
      assert.equal(await toggle(page).getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator("#toggle-monitor").count(), 1, `${label}: still the one button`);
      assert.equal(await page.locator(".pi-chatcol > .pi-monitor-panel").count(), 1, `${label}: the panel is a child of the chat column`);
      assert.equal(await page.locator("#workspace-controls .pi-monitor-panel").count(), 0);
      const shown = await geometry(page);
      assert.equal(shown.mode, shown.chat.width < 900 ? "overlay" : "panel", `${label}: beside the chat while it keeps the room, else floating over it`);
      near(shown.panel.right, shown.button.right, `${label}: the panel's right edge is the button's`);
      if (!overChat) near(shown.panel.right, shown.chat.right - 1 - shown.inset, `${label}: both keep the inset from the card's right edge`);
      near(shown.panel.top, shown.chat.top + 1 + 38, `${label}: the panel hangs under the control strip`);
      near(shown.panel.width, shown.width, `${label}: the panel width`);
      assert(shown.panel.bottom <= shown.chat.bottom + 0.5 && shown.panel.left >= shown.chat.left, `${label}: the panel stays inside the chat column`);
      assert(shown.panel.top >= shown.button.bottom && shown.panel.top - shown.button.bottom <= 8, `${label}: right under the button (${shown.panel.top} vs ${shown.button.bottom})`);
      for (const side of ["left", "top", "width", "height"]) near(shown.button[side], closed.button[side], `${label}: the button stays put when the panel unfolds (${side})`);
      assert.deepEqual(shown.buttonHits, [true], `${label}: the button is still clickable`);
      assert.deepEqual(shown.panelHits, [true, true], `${label}: the panel is above whatever sits behind it`);
      // The button folds it and unfolds it again; so does the panel's own fold; there is no separate close.
      await toggle(page).click();
      await page.locator("#monitor-card").waitFor({ state: "detached" });
      assert.equal(await toggle(page).getAttribute("aria-pressed"), "false");
      assert.equal((await geometry(page)).mode, "chip");
      await toggle(page).click();
      await page.locator("#monitor-card").waitFor();
      assert.equal(await page.locator(".pi-monitor-panel .pi-monitor-head button").count(), 0, `${label}: the pill is the only fold control`);
      await toggle(page).click();
      await page.locator("#monitor-card").waitFor({ state: "detached" });
      assert.equal(await page.locator("#toggle-monitor").count(), 1);
      // A fold in a column too narrow for the panel is the peek going away, not a saved choice.
      assert.equal(await page.evaluate(() => localStorage.getItem("pi.layout.monitorCollapsed")), shown.chat.width < 900 ? "false" : "true", `${label}: the fold is saved unless the column is narrow`);
      await toggle(page).click();
      await page.locator("#monitor-card").waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem("pi.layout.monitorCollapsed")), "false", `${label}: unfolding is saved`);
      await finish(h, `anchor ${label}`);
    }
    // The reconnect button widens the control group; the button keeps its gap to it.
    const recover = await open({ viewport: { width: 1600, height: 900 } }, "c1");
    await recover.page.locator("#topbar-recover").waitFor();
    await recover.page.waitForTimeout(300);
    const gap = await recover.page.evaluate(() => document.querySelector("#workspace-controls").getBoundingClientRect().left - document.querySelector("#toggle-monitor").getBoundingClientRect().right);
    assert(gap >= 4 && gap <= 10, `with the reconnect button, the monitor button keeps an icon gap to the controls (${gap}px)`);
    await finish(recover, "anchor recover");
  });

  await step("the panel's room is inside the chat scroller: scrollbar at the card edge, column centered, gap kept", async () => {
    const messages = Array.from({ length: 24 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: [{ type: "text", text: `row ${index} `.repeat(40) }], timestamp: Date.now() - 60_000 + index, ...(index % 2 ? { stopReason: "stop" } : {}) }));
    const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, messages, messageEntryIds: messages.map((_, index) => `e${index}`) } };
    const measure = (page) => page.evaluate(() => {
      const box = (selector) => document.querySelector(selector)?.getBoundingClientRect();
      const transcript = document.querySelector("#transcript");
      const room = parseFloat(getComputedStyle(transcript).paddingRight);
      const card = box(".pi-chatcol");
      const scroller = box("#transcript");
      // The area the column centers in: the scroller's content box (its scrollbar and the room left out).
      const area = { left: scroller.left + transcript.clientLeft, right: scroller.left + transcript.clientLeft + transcript.clientWidth - room };
      return { mode: document.querySelector(".pi-chatcol").dataset.monitor ?? null, gap: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pi-monitor-gap")), room, card, scroller, area, column: box(".pi-messages"), composer: box(".pi-composer-wrap"), panel: box(".pi-monitor-panel"), bottom: transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight };
    });
    const check = (m, label, { reserved }) => {
      assert(Math.abs(m.scroller.right - (m.card.right - 1)) <= 1 && Math.abs(m.scroller.left - (m.card.left + 1)) <= 1, `${label}: the scroller spans the card (${m.scroller.left}-${m.scroller.right} in ${m.card.left}-${m.card.right})`);
      assert.equal(m.room > 0, reserved, `${label}: room inside the scroller ${reserved ? "taken" : "not taken"} (${m.room})`);
      const centre = (m.area.left + m.area.right) / 2;
      for (const [name, part] of [["column", m.column], ["composer", m.composer]]) {
        assert(Math.abs((part.left + part.right) / 2 - centre) <= 2, `${label}: the ${name} is centered in what is left (${part.left}-${part.right}, area ${m.area.left}-${m.area.right})`);
        if (m.panel) assert(m.panel.left - part.right >= m.gap - 0.5, `${label}: the ${name} keeps ${m.gap}px to the panel (${m.panel.left - part.right})`);
      }
    };
    // Wide: the column keeps the gap as it is. Medium: just under that, the room is taken. Narrow: the column also
    // narrows below its usual width to fit what is left. (With the workspace closed the panel's right edge is the pill's,
    // left of the control group (one icon: the workspace toggle), so it needs 28px more on each side than when it sat at
    // the card's inset.)
    for (const [label, width, reserved] of [["wide", 2400, false], ["medium", 2204, true], ["narrow", 1280, true]]) {
      const h = await open({ snapshots, viewport: { width, height: 900 } });
      const { page } = h;
      await page.locator("#monitor-card").waitFor();
      await page.waitForTimeout(400);
      const unfolded = await measure(page);
      assert.equal(unfolded.mode, "panel", `${label}: the panel unfolds beside the chat`);
      check(unfolded, `${label} unfolded`, { reserved });
      if (reserved) {
        // Following the newest message and the jump button work as before with the room taken.
        const scrollTo = (where) => page.evaluate((top) => { const transcript = document.querySelector("#transcript"); transcript.scrollTop = top === "end" ? transcript.scrollHeight : 0; }, where);
        await scrollTo("end");
        await page.waitForTimeout(200);
        await toggle(page).click();
        await toggle(page).click();
        await page.locator("#monitor-card").waitFor();
        await page.waitForTimeout(300);
        assert((await measure(page)).bottom <= 2, `${label}: at the newest message, folding and unfolding the panel keeps it there`);
        // A reader scroll (wheel), not a scrollTop write: only reader input stops following.
        await page.locator("#transcript").hover();
        await page.mouse.wheel(0, -100000);
        await page.waitForFunction(() => document.querySelector("#transcript").scrollTop === 0);
        await page.waitForTimeout(200);
        await page.evaluate((event) => {
          const source = window.__eventSources.findLast((candidate) => candidate.url.endsWith("/sessions/w1/events"));
          source.dispatchEvent(new MessageEvent("host", { data: JSON.stringify(event) }));
        }, { type: "message", streamId: SNAPSHOTS.w1.streamId, sessionId: "w1", sequence: 40, operationId: "op-room", text: "more" });
        const jump = page.locator("#new-messages");
        await jump.waitFor({ state: "visible" });
        const [jumpBox, now] = [await jump.boundingBox(), await measure(page)];
        assert(Math.abs(jumpBox.x + jumpBox.width / 2 - (now.area.left + now.area.right) / 2) <= 2, `${label}: the jump button is centered under the column`);
        await jump.click();
        await page.waitForFunction(() => { const transcript = document.querySelector("#transcript"); return transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight <= 2; });
      }
      if (label === "narrow") assert(unfolded.column.right - unfolded.column.left < parseFloat(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--pi-thread-min"))), "narrow: the column is narrower than its minimum to fit");
      await toggle(page).click();
      await page.locator("#monitor-card").waitFor({ state: "detached" });
      await page.waitForTimeout(200);
      const folded = await measure(page);
      assert.equal(folded.mode, "chip");
      check(folded, `${label} folded`, { reserved: false });
      await finish(h, `room ${label}`);
    }
  });
}

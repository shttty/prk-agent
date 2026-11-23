import assert from "node:assert/strict";
import { finishWorkbench as finish } from "./workbench/finish-workbench.mjs";
import { toggle } from "./panel/find-toggle.mjs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";
import { snapshotOf } from "../../fixtures/workspace-mock/session-snapshots.mjs";
import { push } from "./collection/push-event.mjs";
import { live } from "./collection/live-monitor-event.mjs";
import { chatcol } from "./panel/find-chat-column.mjs";
import { openCard } from "./panel/open-card.mjs";
import { closeCard } from "./panel/close-card.mjs";

export async function checkReadings(ctx) {
  const { open, step, G, SNAPSHOTS, SESSIONS, FILES, calls, monitor, quiet } = ctx;
  await step("working set memory source on desktop and phone", async () => {
    for (const mobile of [false, true]) {
      const h = await open({ viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 }, mobile });
      await openCard(h.page);
      assert.deepEqual(await h.page.locator("#monitor-kernel-memory [data-used-bytes]").evaluate((node) => ({ used: Number(node.dataset.usedBytes), percent: Number(node.dataset.percent) })), { used: G, percent: 25 }, "working set, not the 95% total cgroup charge");
      if (process.env.PI_TEST_WEB_EVIDENCE) {
        await mkdir(process.env.PI_TEST_WEB_EVIDENCE, { recursive: true });
        await h.page.screenshot({ path: join(process.env.PI_TEST_WEB_EVIDENCE, `kernel-memory-${mobile ? "phone" : "desktop"}.png`), fullPage: true });
      }
      await finish(h, mobile ? "working set phone" : "working set desktop");
    }
  });

  await step("plugin toasts keep clear of the unfolded monitor panel", async () => {
    // The narrowest chat column that still unfolds the panel beside the chat (not as an overlay) is where they collided.
    const toast = { id: "toast-m", type: "error", message: "plugin failed", sessionId: SNAPSHOTS.w1.sessionId, createdAt: new Date(Date.now() + 3_600_000).toISOString() };
    const extensionUi = { revision: 1, autocomplete: false, status: [], notifications: [toast], working: { visible: false }, editor: { text: "", revision: 0 }, widgets: [] };
    for (const width of [1200, 1440]) {
      const h = await open({ viewport: { width, height: 900 }, snapshots: { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, extensionUi } } });
      const { page } = h;
      await openCard(page);
      assert.equal(await chatcol(page).getAttribute("data-monitor"), "panel", `${width}: the panel sits beside the chat`);
      await page.locator('[data-toast-id="toast-m"]').waitFor();
      const { toastRight, panelLeft } = await page.evaluate(() => ({ toastRight: document.querySelector('[data-toast-id="toast-m"]').getBoundingClientRect().right, panelLeft: document.querySelector(".pi-chatcol > .pi-monitor-panel").getBoundingClientRect().left }));
      assert.ok(toastRight <= panelLeft, `${width}: the toast ends left of the panel (${toastRight} <= ${panelLeft})`);
      await finish(h, `toast ${width}`);
    }
  });

  await step("plugin host row and child-session list come from the snapshot only", async () => {
    const remoteHost = { state: "running", generation: "g1", pid: 4242, memory: { workingSet: G / 4, memoryMax: G, memorySwapMax: 0, oomKill: 0 } };
    const sessions = [
      { ...SESSIONS[0], monitor: { ...SESSIONS[0].monitor, remoteHost } },
      { label: "child running", sessionId: "k1", state: "running", target: "alpha", cwd: "/data", derivation: { owner: "w1", createdBy: "w1", phase: "working", lifecycle: "temporary" } },
      { label: "child done", sessionId: "k2", state: "idle", target: "alpha", cwd: "/data", derivation: { owner: "w1", createdBy: "w1", phase: "submitted", lifecycle: "temporary" } },
      ...SESSIONS.slice(1),
    ];
    const h = await open({ sessions, snapshots: { ...SNAPSHOTS, k1: snapshotOf("k1", "running"), k2: snapshotOf("k2", "idle") } });
    const { page } = h;
    await openCard(page);
    assert.equal(await page.locator("#monitor-host").getAttribute("data-status"), "running");
    assert.equal(await page.locator("#monitor-host-memory [data-used-bytes]").getAttribute("data-limit-bytes"), String(G));
    const list = page.locator("#monitor-children");
    assert.deepEqual(await list.evaluate((node) => [node.dataset.count, node.dataset.running, node.dataset.delivered]), ["2", "1", "1"]);
    assert.equal(await list.locator('[data-child="k2"]').getAttribute("data-state"), "delivered");
    await list.locator('[data-child="k2"]').click();
    await page.waitForFunction(() => document.querySelector('[data-session-id="k2"]')?.getAttribute("aria-current") === "true");
    // A session without a remote host and without children shows neither section (nothing is made up).
    await selectSession(page, "w2");
    await openCard(page);
    assert.equal(await page.locator("#monitor-host").count(), 0);
    assert.equal(await page.locator("#monitor-children").count(), 0);
    await finish(h, "host and children");
  });

  await step("icon and session rows show alerts and +N", async () => {
    const h = await open();
    const { page } = h;
    const row = (name) => page.locator(`.management-session-row[data-session-id="${name}"]`);
    assert.equal(await row("w1").getAttribute("data-alert"), "true", "OOM raises the row dot");
    assert.equal(await row("w1").getAttribute("data-delta"), "+12");
    assert.equal(await row("w1").locator(".pi-monitor-dot").count(), 1);
    assert.equal(await row("w2").getAttribute("data-alert"), null, "a quiet session has no dot");
    assert.equal(await row("w2").getAttribute("data-delta"), null, "and no +N when nothing changed");
    assert.equal(await row("w2").locator(".pi-monitor-marks").count(), 0);
    assert.equal(await toggle(page).getAttribute("data-alert"), "true");
    assert.equal(await toggle(page).getAttribute("data-delta"), "+12");
    assert.equal(await page.locator("#workspace-controls #toggle-monitor").count(), 0, "the control group has no monitor icon");
    assert.equal(await page.locator(".pi-chatcol #toggle-monitor").count(), 1, "the button sits in the chat column");
    // row marks stay inside the row (nothing pushed out of the sidebar)
    const box = await row("w1").boundingBox();
    const marks = await row("w1").locator(".pi-monitor-marks").boundingBox();
    assert(marks.x + marks.width <= box.x + box.width && marks.y >= box.y - 1 && marks.y + marks.height <= box.y + box.height + 1);
    // live: the OOM is cleared and the change count moves
    await push(page, live("w1", monitor({ changes: { source: "git", added: 21, removed: 0, truncated: false, ageMs: 0, files: FILES } })));
    await page.waitForFunction(() => document.querySelector('[data-session-id="w1"]').getAttribute("data-alert") === null);
    assert.equal(await row("w1").getAttribute("data-delta"), "+21");
    assert.equal(await toggle(page).getAttribute("data-alert"), null);
    assert.equal(await toggle(page).getAttribute("data-delta"), "+21");
    await push(page, live("w1", monitor({ alerts: { ...quiet, memory: true } })));
    await page.waitForFunction(() => document.querySelector("#toggle-monitor").getAttribute("data-alert") === "true");
    await push(page, live("w1", monitor({ alerts: { ...quiet, kernel: true } })));
    assert.equal(await row("w1").getAttribute("data-alert"), "true");
    await assertUniqueIds(page, "rows");
    await finish(h, "rows");
  });

  await step("card: kernel, machine, changes, basis and ages", async () => {
    calls.length = 0;
    const h = await open();
    const { page } = h;
    await openCard(page);
    assert.equal(await page.locator("#monitor-card").getAttribute("data-collector"), "ok");
    assert.equal(await page.locator("#monitor-kernel").getAttribute("data-status"), "idle");
    assert.equal(await page.locator("#monitor-kernel-memory span").getAttribute("data-percent"), "25");
    assert.equal(await page.locator("#monitor-kernel-oom span").getAttribute("data-count"), "0");
    assert.equal(await page.locator("#monitor-cpu").count(), 1);
    assert.equal(await page.locator("#monitor-machine").getAttribute("data-status"), "ok");
    assert.equal(await page.locator("#monitor-changes").getAttribute("data-source"), "git");
    assert.equal(await page.locator("#monitor-changes").getAttribute("data-git"), "repo");
    assert.equal(await page.locator("#monitor-changes").getAttribute("data-count"), "2");
    assert.equal(await page.locator('#monitor-changes [data-action="open-diff"]').count(), 2);
    assert.equal(await page.locator("#monitor-files-count span").getAttribute("data-count"), "2", "files are a row of their own");
    assert.equal(await page.locator("#monitor-changes .pi-monitor-basis").getAttribute("data-basis"), "git");
    // a zero is neutral: only a real addition/removal carries colour
    const counts = (path) => page.locator(`#monitor-changes [data-path="${path}"] .pi-monitor-counts`);
    assert.deepEqual([await counts("notes.md").locator(".is-add").count(), await counts("notes.md").locator(".is-del").count(), await counts("notes.md").locator(".is-zero").count()], [1, 0, 1], "+2 -0: the -0 is neutral");
    assert.deepEqual([await counts("src/app.py").locator(".is-add").count(), await counts("src/app.py").locator(".is-del").count(), await counts("src/app.py").locator(".is-zero").count()], [1, 1, 0]);
    assert.equal(await page.locator("#monitor-changes .pi-monitor-summary .is-zero").count(), 0);
    await push(page, live("w1", monitor({ changes: { source: "git", added: 5, removed: 0, truncated: false, ageMs: 0, files: [{ path: "a.py", status: "M", added: 5, removed: 0, binary: false }] } })));
    await page.waitForFunction(() => document.querySelectorAll("#monitor-changes .pi-monitor-summary .is-zero").length === 1);
    await push(page, live("w1", monitor({ changes: { source: "git", added: 0, removed: 0, truncated: false, ageMs: 0, files: [] } })));
    await page.waitForFunction(() => document.querySelectorAll("#monitor-changes .pi-monitor-summary .is-zero").length === 2);
    assert.equal(await page.locator("#monitor-files-count span").getAttribute("data-count"), "0");
    await push(page, live("w1", monitor()));
    await page.waitForFunction(() => document.querySelectorAll('#monitor-changes [data-action="open-diff"]').length === 2);
    // desktop buttons keep their compact size
    assert((await page.locator("#monitor-kernel-restart").boundingBox()).height < 32, "mouse layout is unchanged");
    const age = Number(await page.locator("#monitor-machine-age").getAttribute("data-seconds"));
    assert(age >= 4 && age < 8, `machine age counts from ageMs (${age})`);
    // The ticker fires once a second, so a fixed 2.2 s sleep sees +1 or +2 depending on its phase: wait for the +2.
    await page.waitForFunction((base) => Number(document.querySelector("#monitor-machine-age")?.getAttribute("data-seconds")) >= base + 2, age, { timeout: 5000 });
    // the lease while the panel is unfolded: sent once it shows and repeated, released on close
    assert.deepEqual(calls[0], ["focus", true]);
    await page.waitForTimeout(1500);
    assert(calls.filter((call) => call[0] === "focus" && call[1] === true).length >= 2, "the lease is repeated while the panel is open");
    // the panel floats above the chat column: its centre hits the panel, not a control behind it
    const hit = await page.evaluate(() => { const panel = document.querySelector(".pi-monitor-panel").getBoundingClientRect(); return document.elementFromPoint(panel.x + panel.width / 2, panel.y + 24)?.closest(".pi-monitor-panel") !== null; });
    assert.equal(hit, true);
    // a wide chat column leaves the panel its room: no message or composer under it
    assert.equal(await chatcol(page).getAttribute("data-monitor"), "panel");
    const panelBox = await page.locator(".pi-monitor-panel").boundingBox();
    for (const selector of [".pi-messages", "#composer-form"]) {
      const box = await page.locator(selector).boundingBox();
      assert(box.x + box.width <= panelBox.x, `${selector} ends left of the panel (${box.x + box.width} > ${panelBox.x})`);
    }
    // kernel buttons: idle kernel allows restart/clear, nothing to interrupt
    assert.equal(await page.locator("#monitor-kernel-interrupt").isDisabled(), true);
    await page.locator("#monitor-kernel-restart").click();
    await page.locator("#monitor-kernel-clear").click();
    await page.waitForFunction(() => !document.querySelector("#monitor-kernel-clear")?.hasAttribute("data-loading"));
    assert.deepEqual(calls.filter((call) => call[0] === "restart" || call[0] === "clear"), [["restart"], ["clear"]]);
    await closeCard(page);
    await page.waitForTimeout(100);
    assert.deepEqual(calls.at(-1), ["focus", false], "closing the panel releases the lease");
    await finish(h, "card");
  });
}

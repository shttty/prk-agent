import assert from "node:assert/strict";
import { finishWorkbench as finish } from "./workbench/finish-workbench.mjs";
import { toggle } from "./panel/find-toggle.mjs";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";
import { push } from "./collection/push-event.mjs";
import { live } from "./collection/live-monitor-event.mjs";
import { chatcol } from "./panel/find-chat-column.mjs";
import { openCard } from "./panel/open-card.mjs";
import { closeCard } from "./panel/close-card.mjs";
import { assertPillLook } from "./panel/assert-pill-look.mjs";

export async function checkStatesAndDiffs(ctx) {
  const { open, step, SNAPSHOTS, kernel, TARGETS, monitor, quiet, machine, calls } = ctx;
  await step("a kernel that is gone shows its numbers as the last reading", async () => {
    const gone = { ...SNAPSHOTS.w1, kernel: kernel({ state: "unavailable", connectionStatus: "disconnected" }) };
    const h = await open({ snapshots: { ...SNAPSHOTS, w1: gone } });
    await openCard(h.page);
    assert.equal(await h.page.locator("#monitor-kernel").getAttribute("data-status"), "unavailable");
    assert.equal(await h.page.locator("#monitor-kernel-memory span").getAttribute("data-stale"), "true", "memory of an unavailable kernel is marked as the last reading");
    assert.equal(await h.page.locator("#monitor-kernel-oom span").getAttribute("data-stale"), "true");
    assert.equal(await h.page.locator("#monitor-kernel-restart").isDisabled(), true);
    await closeCard(h.page);
    await selectSession(h.page, "w2");
    await openCard(h.page);
    assert.equal(await h.page.locator("#monitor-kernel-memory span").getAttribute("data-stale"), null, "a running kernel's numbers are live");
    await finish(h, "stale kernel");
  });

  await step("busy kernel disables restart and clear", async () => {
    const busy = { ...SNAPSHOTS.w1, state: "running", kernel: kernel({ state: "busy" }) };
    const h = await open({ snapshots: { ...SNAPSHOTS, w1: busy } });
    await openCard(h.page);
    assert.equal(await h.page.locator("#monitor-kernel-restart").isDisabled(), true);
    assert.equal(await h.page.locator("#monitor-kernel-clear").isDisabled(), true);
    assert.equal(await h.page.locator("#monitor-kernel-interrupt").isDisabled(), false, "a running turn can be interrupted");
    assert.equal(await h.page.locator("#monitor-card").getAttribute("data-target"), TARGETS[0].name);
    await finish(h, "busy/worker");
  });

  await step("dirty states: sleeping, collector error, starting, no data", async () => {
    const h = await open();
    const { page } = h;
    await push(page, live("w1", { ...monitor(), state: "stopped" }));
    await openCard(page);
    assert.equal(await page.locator("#monitor-card").getAttribute("data-collector"), "stopped");
    assert.equal(await page.locator("#monitor-note").getAttribute("role"), "status");
    assert.equal(await page.locator("#monitor-machine").getAttribute("data-status"), "ok", "the last values stay while asleep");
    await push(page, live("w1", { state: "error", error: "terminal refused", alerts: quiet, machine: machine() }));
    await page.waitForFunction(() => document.querySelector("#monitor-card").getAttribute("data-collector") === "error");
    assert.equal(await page.locator("#monitor-note").getAttribute("role"), "alert");
    assert.equal(await page.locator("#monitor-changes").getAttribute("data-status"), "none");
    await push(page, live("w1", { state: "starting", alerts: quiet }));
    await page.waitForFunction(() => document.querySelector("#monitor-card").getAttribute("data-collector") === "starting");
    assert.equal(await page.locator("#monitor-machine").getAttribute("data-status"), "none", "no data yet: placeholder, not zeros");
    await assertUniqueIds(page, "dirty card");
    await closeCard(page);
    // a session that never had a monitor opens an empty card
    await selectSession(page, "c1");
    await openCard(page);
    assert.equal(await page.locator("#monitor-card").getAttribute("data-collector"), "none");
    await finish(h, "dirty");
  });

  await step("a file opens its diff tab (git unified text), persists, reloads", async () => {
    calls.length = 0;
    const h = await open();
    const { page } = h;
    await openCard(page);
    await page.locator('#monitor-changes [data-action="open-diff"][data-path="src/app.py"]').click();
    // the workspace opens beside the chat: the column is now too narrow for the panel, which folds to its button
    await page.locator("#monitor-card").waitFor({ state: "detached" });
    assert.equal(await toggle(page).getAttribute("aria-pressed"), "false");
    assert.equal(await chatcol(page).getAttribute("data-monitor"), "chip");
    const diffTab = page.locator('.pi-tab[data-kind="diff"][data-path="src/app.py"]');
    await diffTab.waitFor();
    const pane = page.locator('.pi-diff[data-path="src/app.py"][data-status="ok"]');
    await pane.waitFor();
    assert.equal(await pane.getAttribute("data-source"), "git");
    assert.equal(await pane.locator(".pi-cl.is-add").count(), 2);
    assert.equal(await pane.locator(".pi-cl.is-del").count(), 1);
    assert.equal(await pane.locator(".pi-cl.is-ctx").count(), 2);
    assert.equal(await page.locator('#desktop-stage[data-open="true"] .pi-stage-grid').isVisible(), true);
    // unfolded in the narrow column, the panel floats over the chat until folded again; that fold is not saved
    await toggle(page).click();
    await page.locator("#monitor-card").waitFor();
    assert.equal(await chatcol(page).getAttribute("data-monitor"), "overlay");
    // the same file again focuses the tab instead of adding one
    await page.locator('#monitor-changes [data-action="open-diff"][data-path="src/app.py"]').click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.pi-tab[data-kind="diff"]').count(), 1);
    await assertUniqueIds(page, "diff tab");
    await toggle(page).click();
    await page.locator("#monitor-card").waitFor({ state: "detached" });
    assert.notEqual(await page.evaluate(() => localStorage.getItem("pi.layout.monitorCollapsed")), "true", "folding the floated panel back is not a saved fold");
    await page.reload();
    await selectSession(page, "w1");
    await page.locator('.pi-tab[data-kind="diff"][data-path="src/app.py"]').waitFor();
    await page.locator('.pi-diff[data-path="src/app.py"][data-status="ok"]').waitFor();
    assert(calls.filter((call) => call[0] === "diff").length >= 2, "a restored diff tab fetches the current diff again");
    await finish(h, "diff");
  });

  await step("agent-source diff (no git) uses the edit-row format", async () => {
    const h = await open({}, "w3");
    const { page } = h;
    await openCard(page);
    assert.equal(await page.locator("#monitor-changes").getAttribute("data-source"), "agent");
    assert.equal(await page.locator("#monitor-changes").getAttribute("data-git"), "none", "no repository here: the basis says so");
    assert.equal(await page.locator("#monitor-changes .pi-monitor-basis").getAttribute("data-basis"), "volume", "the agent source is presented as an amount of change, not as a diff");
    assert.equal(await page.locator("#monitor-files-count span").getAttribute("data-count"), "1", "agent source: distinct files written or edited");
    await push(page, live("w3", monitor({ changes: { source: "agent", added: 4, removed: 1, truncated: false, ageMs: 0, gitUnavailable: true, gitReason: "fatal: detected dubious ownership", files: [{ path: "note.txt", status: "M", added: 4, removed: 1, binary: false }] } })));
    await page.waitForFunction(() => document.querySelector("#monitor-changes").getAttribute("data-git") === "unavailable");
    assert.equal(await page.locator("#monitor-changes .pi-monitor-basis").getAttribute("data-reason"), "fatal: detected dubious ownership", "git's reason is shown when git could not decide");
    await page.locator('#monitor-changes [data-action="open-diff"]').click();
    const pane = page.locator('.pi-diff[data-path="note.txt"][data-status="ok"]');
    await pane.waitFor();
    assert.equal(await pane.getAttribute("data-source"), "agent");
    assert.equal(await pane.locator(".pi-cl.is-add").count(), 2);
    assert.equal(await pane.locator(".pi-cl.is-del").count(), 1);
    await finish(h, "agent diff");
  });

  await step("phone: the icon is in the top bar and the panel is a full-width sheet", async () => {
    const h = await open({ viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = h;
    assert.equal(await page.locator(".topbar #toggle-monitor").count(), 1);
    assert.equal(await page.locator(".pi-monitor-panel").count(), 0, "the phone opens the sheet on demand");
    await page.locator("#toggle-monitor").click();
    await page.locator("#monitor-card").waitFor();
    assert.equal(await page.locator(".pi-monitor-panel .pi-monitor-head button").count(), 0, "a sheet has no fold control of its own");
    const card = await page.locator(".pi-monitor-panel").boundingBox();
    assert(card.x >= 0 && card.x <= 12 && card.x + card.width >= 390 - 12, `full-width sheet (${JSON.stringify(card)})`);
    await assertUniqueIds(page, "phone card");
    // finger-sized buttons on a coarse pointer, with room between them
    const buttons = [];
    for (const id of ["restart", "interrupt", "clear"]) buttons.push(await page.locator(`#monitor-kernel-${id}`).boundingBox());
    for (const box of buttons) assert(box.height >= 36, `kernel button is ${box.height}px high on a touch screen`);
    for (let index = 1; index < buttons.length; index += 1) {
      const sameRow = Math.abs(buttons[index].y - buttons[index - 1].y) < 4;
      assert(!sameRow || buttons[index].x - (buttons[index - 1].x + buttons[index - 1].width) >= 8, "buttons on a row are at least 8px apart");
    }
    assert((await page.locator('#monitor-changes [data-action="open-diff"]').first().boundingBox()).height >= 36, "file rows are finger-sized too");
    await page.locator('#monitor-changes [data-action="open-diff"][data-path="src/app.py"]').click();
    await page.locator('.pi-diff[data-path="src/app.py"][data-status="ok"]').waitFor();
    assert.equal(await page.locator("#file-tree").isVisible(), false, "the diff is shown, not the directory sheet");
    await finish(h, "phone");
  });

  await step("dark scheme renders the panel", async () => {
    const h = await open({ colorScheme: "dark" });
    await openCard(h.page);
    await assertPillLook(h.page, "dark");
    const color = await h.page.locator(".pi-monitor-panel").evaluate((node) => getComputedStyle(node).backgroundColor);
    assert.notEqual(color, "rgba(0, 0, 0, 0)");
    await finish(h, "dark");
  });
}

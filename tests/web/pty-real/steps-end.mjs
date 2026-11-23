import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const listed = async (rig, id) => (await (await fetch(`${rig.fixture.url}/api/sessions/${id}/terminals`, { headers: { origin: rig.fixture.url } })).json()).terminals;

/** End of life: target link broken (old generation ends, nothing is recreated or replayed), explicit reopen, natural exit,
 * and the close dialog against the fixture's refused close route (the cleanup chain is BLOCKED, so only that is observable). */
export function endSteps(rig, state) {
  const { a } = state;
  return [
    ["target connection lost: old generations end for good (4000), nothing is created, typed input is not replayed", async () => {
      const d = state.d;
      const before = rig.fixture.identities.length;
      const socketsBefore = d.seen.sockets.length;
      await rig.fixture.disconnectTarget();
      // Each old tab ends in a final state: the server's `closed` frame closes the tab, a final error leaves a `failed` view.
      const ended = async (shell) => { for (let i = 0; i < 200; i++) { if (!(await d.tab(shell).count())) return "tab closed"; if ((await d.view(shell).getAttribute("data-status")) === "failed") return "failed view"; await d.page.waitForTimeout(100); } throw new Error(`${shell} neither closed nor failed`); };
      state.endedAs = { shell: await ended("shell"), model: await ended("model") };
      // The connected sockets themselves end (no reconnect is needed for the tab to close): their last close code is read once recorded.
      const old = () => d.seen.sockets.filter((entry) => entry.session === a);
      for (let i = 0; i < 100 && old().some((entry) => entry.closeCode === null); i++) await d.page.waitForTimeout(50);
      const last = (shell) => old().filter((entry) => entry.shell === shell).at(-1);
      await rig.log({ endedAs: state.endedAs, oldSockets: old().map((entry) => ({ shell: entry.shell, query: Boolean(entry.generationQuery), types: [...entry.types], closeCode: entry.closeCode })) });
      assert.deepEqual([last("shell").closeCode, last("model").closeCode], [4000, 4000], "both old generations ended with the final close code");
      const after = d.seen.sockets.slice(socketsBefore);
      assert.deepEqual(after.filter((entry) => !entry.generationQuery), [], "no reconnect ever dropped the generation");
      await d.page.waitForTimeout(2500);
      assert.equal(d.seen.sockets.length, socketsBefore + after.length, "nothing reconnects after the final state");
      assert.deepEqual(await listed(rig, a), [], "the Gateway has no terminal for the old tabs: nothing was recreated");
      assert.equal(rig.fixture.identities.length, before, "no new shell identity appeared");
      await d.shot("04-after-target-loss");
      await state.p.page.waitForTimeout(500);
      await state.p.shot("05-phone-after-target-loss");
    }],
    ["explicit reopen: a new open without generation gets a new generation and a new real shell", async () => {
      const d = state.d;
      const old = state.generation;
      const known = d.seen.sockets.length;
      if (await d.view("shell").locator('[data-action="reopen-terminal"]').count()) await d.view("shell").locator('[data-action="reopen-terminal"]').click();
      else await d.page.locator("#new-terminal").click();
      for (let i = 0; i < 100 && d.seen.sockets.length === known; i++) await d.page.waitForTimeout(100);
      const reopened = d.seen.sockets.at(-1);
      for (let i = 0; i < 100 && !reopened.snapshot; i++) await d.page.waitForTimeout(100);
      assert.equal(reopened.generationQuery, null, "reopen is a new open");
      assert.notEqual(reopened.snapshot.generation, old);
      assert.ok(rig.fixture.identities.some((entry) => entry.generation === reopened.snapshot.generation && entry.sessionId === a), "the fixture saw one new real shell");
      state.reopenedShell = reopened.shell;
      await d.status(reopened.shell, "connected");
      await d.run(reopened.shell, "printf 'NEW_%s\\n' SHELL");
      await d.waitText(reopened.shell, "NEW_SHELL");
      assert.ok(!(await d.text(reopened.shell)).includes("MARK_ONE"), "a new shell, not the old replay");
      const frames = d.seen.sockets.flatMap((entry) => entry.input).join("");
      assert.ok(!frames.includes("SHOULD_NOT_REPLAY"));
      await d.shot("06-reopened");
      state.generation = reopened.snapshot.generation;
    }],
    ["a shell that exits by itself closes its tab and nothing reconnects", async () => {
      const d = state.d;
      await rig.fixture.exitShell(a, state.reopenedShell);
      await d.tab(state.reopenedShell).waitFor({ state: "detached" });
      const count = d.seen.sockets.length;
      await d.page.waitForTimeout(2000);
      assert.equal(d.seen.sockets.length, count, "no reconnect after the final closed state");
      assert.deepEqual((await listed(rig, a)).map((entry) => entry.name), []);
    }],
    ["close dialog on the real close route: asks first, success closes the tab and the shell process is gone", async () => {
      const d = state.d;
      const model = await rig.fixture.openModel(a, "extra");
      await rig.log({ cleanupCapability: model.cleanup ?? null });
      await d.evaluate(() => window.__harness.refresh());
      await d.tab("extra").waitFor();
      await d.tab("extra").locator('[data-action="close-tab"]').click();
      await d.page.locator("#confirm-end-terminal").waitFor();
      await rig.log({ endDialogText: (await d.page.locator("#end-terminal-dialog").innerText()).trim() });
      assert.equal(await d.page.locator('#end-terminal-dialog [data-cleanup="normal-close-only"]').count(), model.cleanup === "normal-close-only" ? 1 : 0, "the degraded-cleanup note appears exactly when the target reports it");
      await d.shot("07-end-dialog");
      await d.page.locator('#end-terminal-dialog [data-action="cancel"]').click();
      await d.page.locator("#confirm-end-terminal").waitFor({ state: "detached" });
      assert.equal(await d.tab("extra").count(), 1, "cancel closes nothing");
      const identity = rig.fixture.identities.find((entry) => entry.generation === model.generation);
      const alive = async () => { const stat = await readFile(`/proc/${identity.pid}/stat`, "utf8").catch(() => ""); return Boolean(stat) && stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] === identity.start; };
      assert.equal(await alive(), true, "the shell is alive before the close");
      await d.tab("extra").locator('[data-action="close-tab"]').click();
      await d.page.locator("#confirm-end-terminal").click();
      await d.tab("extra").waitFor({ state: "detached" });
      assert.deepEqual((await listed(rig, a)).map((entry) => entry.name), [], "the Gateway no longer lists it");
      for (let i = 0; i < 100 && await alive(); i++) await d.page.waitForTimeout(100);
      assert.equal(await alive(), false, "an independent /proc check: the recorded shell PID (same starttime) is gone");
      await d.shot("08-after-close");
    }],
    ["no page errors; no failed response other than the file routes this fixture does not serve", async () => {
      for (const driver of [state.d, state.p]) {
        assert.deepEqual(driver.seen.errors, [], `${driver.name} page errors`);
        const unexpected = driver.seen.failed.filter((entry) => !entry.url.includes("/files/"));
        assert.deepEqual(unexpected, [], `${driver.name} unexpected failed responses`);
      }
    }],
  ];
}

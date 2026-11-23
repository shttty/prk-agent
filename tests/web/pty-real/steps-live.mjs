import assert from "node:assert/strict";
import { openPage } from "./page-driver.mjs";

const lastSize = (text) => { const found = [...text.matchAll(/^(\d+) (\d+)$/gmu)].at(-1); return found ? { rows: Number(found[1]), cols: Number(found[2]) } : null; };

/** Live behaviour of real shell tabs: first open, input/UTF-8/Ctrl-C, resize, model tab, switching sessions, network drop. */
export function liveSteps(rig, state) {
  const [a, b] = rig.fixture.sessions.map((session) => session.sessionId);
  state.a = a; state.b = b;
  return [
    ["first shell: a user-opened tab connects without generation, takes it from the snapshot; echo, UTF-8 and Ctrl-C reach the PTY", async () => {
      const d = state.d = await openPage(rig, { name: "desktop", sessionId: a });
      await d.tab("shell").waitFor();
      await d.connected("shell").waitFor();
      const first = d.sockets("shell")[0];
      assert.equal(first.generationQuery, null, "a new tab's first connection carries no generation");
      assert.equal(typeof first.snapshot.generation, "string");
      assert.equal(await d.tab("shell").getAttribute("data-owner"), "user");
      await d.run("shell", "printf 'MARK_%s\\n' ONE");
      await d.waitText("shell", "MARK_ONE");
      await d.run("shell", "echo 你好终端");
      await d.waitText("shell", "你好终端");
      await d.run("shell", "sleep 60");
      await d.page.waitForTimeout(300);
      await d.page.keyboard.press("Control+C");
      await d.run("shell", "echo AFTER_CTRLC");
      await d.waitText("shell", "AFTER_CTRLC");
      state.generation = first.snapshot.generation;
      await d.shot("01-shell");
    }],
    ["resize: the PTY learns its group's new size when the stage shrinks past the chat's floor", async () => {
      const d = state.d;
      await d.run("shell", "stty size");
      await d.page.waitForTimeout(500);
      const before = lastSize(await d.text("shell"));
      assert.ok(before && before.cols > 20, `size before: ${JSON.stringify(before)}`);
      await d.evaluate(() => window.__harness.setStageWidth(1000));
      await d.page.waitForTimeout(900);
      await d.run("shell", "stty size");
      await d.page.waitForTimeout(500);
      const after = lastSize(await d.text("shell"));
      assert.ok(after.cols < before.cols, `cols shrank: ${before.cols} → ${after.cols}`);
      await d.evaluate(() => window.__harness.setStageWidth(null));
    }],
    ["model tab: shown with owner/label, subscribes with the listed generation", async () => {
      const d = state.d;
      const model = await rig.fixture.openModel(a, "model");
      await d.evaluate(() => window.__harness.refresh());
      await d.tab("model").waitFor();
      assert.equal(await d.tab("model").getAttribute("data-owner"), "model");
      await d.focus("model");
      await d.connected("model").waitFor();
      const socket = d.sockets("model")[0];
      assert.equal(socket.generationQuery, model.generation, "a tab made from the terminal list subscribes with that entry's generation");
      assert.equal(socket.snapshot.owner, "model");
      await d.shot("02-model-tab");
      state.modelGeneration = model.generation;
    }],
    ["switching sessions and back re-subscribes with the same generation and replays the output", async () => {
      const d = state.d;
      await d.evaluate((id) => window.__harness.setSession(id), b);
      await d.tab("shell").waitFor();
      await d.connected("shell").waitFor();
      const other = d.sockets("shell").find((entry) => entry.session === b);
      assert.equal(other.generationQuery, null, "session B's first shell is a new tab");
      assert.notEqual(other.snapshot.generation, state.generation);
      const known = d.seen.sockets.length;
      await d.evaluate((id) => window.__harness.setSession(id), a);
      await d.tab("model").waitFor();
      // Back on A the model tab is the shown one: the shell tab is a background tab, whose terminal stays outside the
      // document until it is shown (TERMINAL_RENDERER), so its re-subscription is read from its socket.
      for (let i = 0; i < 200 && !d.seen.sockets.slice(known).some((entry) => entry.shell === "shell" && entry.session === a && entry.snapshot); i++) await d.page.waitForTimeout(100);
      const again = d.sockets("shell").filter((entry) => entry.session === a).at(-1);
      assert.equal(again.generationQuery, state.generation);
      assert.equal(again.snapshot.generation, state.generation, "same generation, not a new shell");
      assert.match(again.snapshot.replay, /MARK_ONE/u, "the replay carries the earlier output");
      await d.focus("shell");
      await d.waitText("shell", "MARK_ONE");
      assert.equal((await d.tab("model").getAttribute("data-owner")), "model");
    }],
    ["network drop of the page's socket: it re-subscribes with the same generation and replay, input still works", async () => {
      const d = state.d;
      const live = d.sockets("shell").filter((entry) => entry.session === a);
      const count = live.length;
      await live.at(-1).page.close({ code: 1012, reason: "network" });
      for (let i = 0; i < 100 && d.sockets("shell").filter((entry) => entry.session === a).length === count; i++) await d.page.waitForTimeout(100);
      const next = d.sockets("shell").filter((entry) => entry.session === a).at(-1);
      assert.equal(next.generationQuery, state.generation, "the reconnect names the old generation");
      await d.connected("shell").waitFor();
      assert.equal(next.snapshot.generation, state.generation);
      assert.match(next.snapshot.replay, /AFTER_CTRLC/u);
      await d.run("shell", "echo RECONNECTED_OK");
      await d.waitText("shell", "RECONNECTED_OK");
    }],
    ["phone: the same shell on a compact pane connects and is usable", async () => {
      const p = state.p = await openPage(rig, { name: "phone", sessionId: b, compact: true });
      await p.tab("shell").waitFor();
      await p.connected("shell").waitFor();
      await p.run("shell", "printf 'PHONE_%s\\n' OK");
      await p.waitText("shell", "PHONE_OK");
      await p.shot("03-phone-shell");
    }],
  ];
}

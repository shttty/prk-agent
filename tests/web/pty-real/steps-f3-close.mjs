import assert from "node:assert/strict";
import { openPage } from "./page-driver.mjs";

const openApp = async (rig, name, sessionId) => {
  const d = await openPage(rig, { name, app: true });
  await d.page.locator(`[data-session-id="${sessionId}"] .management-session-select`).click();
  await d.page.locator(`[data-session-id="${sessionId}"][aria-current="true"]`).waitFor({ state: "attached" });
  await d.page.locator("#toggle-workspace").click();
  await d.page.locator('#desktop-stage[data-open="true"]').waitFor();
  return d;
};

/** Real close refused by the Gateway's HTTP body budget (413): the dialog shows the failure, the tab, its generation and its
 * shell stay and keep working, and a second attempt is refused the same way. The fixture's shutdown ends it afterwards. */
export function closeRefusedSteps(rig, state) {
  const [a] = rig.fixture.sessions.map((session) => session.sessionId);
  const name = `close-admission-${"x".repeat(144)}`;
  return [
    ["real 413 close: refused, tab and generation kept, input still reaches the same shell; refused again", async () => {
      const snapshot = await rig.fixture.openModel(a, name);
      const d = state.c = await openApp(rig, "close413", a);
      await d.tab(name).waitFor(); await d.status(name, "connected");
      const identity = rig.fixture.identities.find((entry) => entry.generation === snapshot.generation);
      const socketsBefore = d.sockets(name).length;
      for (const attempt of [1, 2]) {
        await d.tab(name).locator('[data-action="close-tab"]').click();
        await d.page.locator("#confirm-end-terminal").click();
        await d.page.locator("#end-terminal-dialog [role=alert]").waitFor();
        assert.ok(d.seen.failed.filter((entry) => entry.url.endsWith("/terminals/close") && entry.status === 413).length >= attempt, `attempt ${attempt}: the close request got 413`);
        if (attempt === 1) await d.shot("41-close-413");
        await d.page.locator('#end-terminal-dialog [data-action="cancel"]').click();
        await d.page.locator("#confirm-end-terminal").waitFor({ state: "detached" });
        assert.equal(await d.tab(name).count(), 1, `attempt ${attempt}: the tab stays`);
        assert.equal(d.sockets(name).length, socketsBefore, `attempt ${attempt}: no reconnect, same socket`);
        assert.equal(d.sockets(name).at(-1).closeCode, null, `attempt ${attempt}: the socket is still open`);
        await d.run(name, `printf 'STILL_%s\\n' ${attempt}`);
        await d.waitText(name, `STILL_${attempt}`);
      }
      const listed = await (await fetch(`${rig.fixture.url}/api/sessions/${a}/terminals`, { headers: { origin: rig.fixture.url } })).json();
      assert.equal(listed.terminals.find((entry) => entry.name === name)?.generation, snapshot.generation, "the Gateway still lists the same generation");
      const stat = await import("node:fs/promises").then((fs) => fs.readFile(`/proc/${identity.pid}/stat`, "utf8"));
      assert.equal(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19], identity.start, "the same shell process (PID and starttime) is alive");
      await rig.log({ close413: { name: name.length, generation: snapshot.generation, pid: identity.pid, failed: d.seen.failed } });
      await d.shot("42-after-413");
    }],
  ];
}

/** ModelTerminals hard timeout on the human terminal the App opened: the backend kills and rebuilds it under the same name with
 * a new generation; the page's old socket ends with 4000 and the page never subscribes to the old generation again; the
 * terminal comes back only through the real final-state path (reopen, or the list re-read), on the new generation. */
export function hardTimeoutSteps(rig, state) {
  const [a] = rig.fixture.sessions.map((session) => session.sessionId);
  return [
    ["hard timeout: real kill + rebuild; old socket 4000; the UI comes back on the new generation only", async () => {
      const d = state.t = await openApp(rig, "timeout", a);
      await d.tab("shell").waitFor(); await d.status("shell", "connected");
      const old = d.sockets("shell").at(-1).snapshot.generation;
      const { result, before, after } = await rig.fixture.runModelCommand(a, { name: "shell", text: "trap '' INT; while :; do sleep 1; done", timeout_s: 0.2, yield_s: 10 });
      await rig.log({ hardTimeout: { status: result.status, note: result.note, before: before?.generation, after: after?.generation } });
      assert.equal(result.status, "killed");
      assert.equal(before.generation, old);
      assert.notEqual(after.generation, old);
      for (let i = 0; i < 100 && d.sockets("shell").filter((entry) => entry.snapshot?.generation === old).some((entry) => entry.closeCode === null); i++) await d.page.waitForTimeout(100);
      assert.ok(d.sockets("shell").filter((entry) => entry.snapshot?.generation === old).every((entry) => entry.closeCode === 4000), "the old generation's socket ended with 4000");
      let endedAs = null;
      for (let i = 0; i < 100 && !endedAs; i++) {
        if (!(await d.tab("shell").count())) endedAs = "tab closed";
        else if ((await d.view("shell").getAttribute("data-status")) === "failed") endedAs = "failed view";
        else await d.page.waitForTimeout(100);
      }
      await rig.log({ hardTimeoutEndedAs: endedAs });
      assert.ok(endedAs, "the old tab reached a final state");
      await d.shot("43-after-timeout");
      const known = d.seen.sockets.length;
      if (endedAs === "failed view") await d.view("shell").locator('[data-action="reopen-terminal"]').click();
      // The old tab was the last one, so closing it closed the workspace ("the last tab closes it"); opening the workspace
      // again reads the terminal list, which now holds the rebuilt shell.
      else if (!(await d.page.locator('#desktop-stage[data-open="true"]').count())) await d.page.locator("#toggle-workspace").click();
      await d.status("shell", "connected");
      const tabs = await d.page.locator('#desktop-stage .pi-tab[data-kind="terminal"][data-shell="shell"]').evaluateAll((nodes) => nodes.map((node) => ({ visible: node.offsetParent !== null, id: node.closest("[id]")?.id ?? null })));
      await rig.log({ shellTabsAfterReopen: tabs });
      assert.equal(tabs.filter((tab) => tab.visible).length, 1, "exactly one visible shell tab");
      const later = d.seen.sockets.slice(known);
      assert.deepEqual(later.filter((entry) => entry.generationQuery === old), [], "nothing subscribed to the old generation again");
      assert.equal(later.at(-1).snapshot.generation, after.generation, "the tab now shows the rebuilt shell");
      await d.run("shell", "printf 'REBUILT_%s\\n' OK");
      await d.waitText("shell", "REBUILT_OK");
      await d.shot("44-rebuilt");
    }],
  ];
}

/** Ending a shell through its tab (button + confirm) when the HTTP close completes BEFORE the real WS `closed` frame reaches
 * the page (the frame is held by the pass-through until the close request has finished, nothing is answered for the server):
 * the tab goes away once, the page throws nothing, and the other shell keeps its view, its socket and its generation. */
export function closeOrderSteps(rig, state) {
  const [a] = rig.fixture.sessions.map((session) => session.sessionId);
  return [
    ["end a shell, HTTP close finished before its WS closed frame: the tab goes, no page error, the other shell stays", async () => {
      const d = state.o = await openApp(rig, "close-order", a);
      await d.tab("shell").waitFor(); await d.status("shell", "connected");
      const shellSocket = d.sockets("shell").at(-1);
      await d.page.locator("#new-terminal").click();
      await d.tab("shell-2").waitFor(); await d.status("shell-2", "connected");
      const ended = d.sockets("shell-2").at(-1);
      const finished = new Promise((resolve) => {
        const on = (request) => { if (request.url().endsWith("/terminals/close")) { d.page.off("requestfinished", on); resolve(); } };
        d.page.on("requestfinished", on);
      });
      d.holdClosed("shell-2", finished);
      await d.tab("shell-2").hover();
      await d.tab("shell-2").locator('[data-action="close-tab"]').click();
      await d.page.locator("#confirm-end-terminal").click();
      await d.tab("shell-2").waitFor({ state: "detached" });
      for (let i = 0; i < 50 && ended.closeCode === null; i++) await d.page.waitForTimeout(100);
      await d.page.waitForTimeout(300);
      await rig.log({ closeOrder: { held: Boolean(ended.closedHeld), closeCode: ended.closeCode, errors: d.seen.errors } });
      assert.ok(ended.closedHeld, "the real closed frame was held until the HTTP close had finished");
      assert.equal(ended.closeCode, 4000, "the ended shell's socket closed as final");
      assert.deepEqual(d.seen.errors, [], "no page error");
      assert.equal(await d.tab("shell-2").count(), 0, "the ended shell's tab is gone");
      assert.equal(await d.tab("shell").count(), 1, "the other shell's tab stays");
      await d.status("shell", "connected");
      assert.equal(d.sockets("shell").at(-1), shellSocket, "the other shell kept its socket");
      assert.equal(shellSocket.closeCode, null, "and it is still open");
      const listed = await (await fetch(`${rig.fixture.url}/api/sessions/${a}/terminals`, { headers: { origin: rig.fixture.url } })).json();
      assert.deepEqual(listed.terminals.map((entry) => entry.name).sort(), ["shell"], "the Gateway lists only the other shell");
      assert.equal(listed.terminals[0].generation, shellSocket.snapshot.generation, "on the generation it had");
      await d.shot("45-close-order");
    }],
  ];
}

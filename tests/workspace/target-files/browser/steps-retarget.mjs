import assert from "node:assert/strict";
import { readFile, writeFile, access } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { openPage } from "./page-driver.mjs";

const exists = (path) => access(path).then(() => true, () => false);
const until = async (check, label, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await check()) return; await delay(100); } throw new Error(`Timed out: ${label}`); };

/** Same-session retarget with a dirty draft: old-target writes are refused by the Gateway, late old responses land nowhere. */
export function retargetSteps(rig, seed, state) {
  const file = seed.at("rt.txt");
  const second = { target: "owned2", cwd: seed.at("proj2") };
  const back = { target: "owned", cwd: seed.work };
  const third = { target: "owned3", cwd: seed.at("proj2") };
  const post = async (route, body) => {
    const response = await fetch(`${rig.gateway.url}/api/sessions/${rig.gateway.sessionId}/files/${route}`, { method: "POST", headers: { "content-type": "application/json", origin: rig.gateway.url }, body: JSON.stringify(body) });
    return { status: response.status, json: await response.json() };
  };
  const toolbar = (r) => r.editor(file);
  const writes = (r) => r.fileRequests().filter((request) => request.path.endsWith("/files/write"));
  return [
    ["authoritative target moves while the page still shows the old one: save is refused, the draft stays", async () => {
      await writeFile(file, "original\n");
      const r = state.retarget = await openPage(rig, { name: "retarget" });
      await r.row(file).locator(".pi-files-row").click();
      await r.waitText(file, "original");
      await r.typeInto(file, "-draft");
      await r.page.locator(`.pi-tab[data-path="${file}"][data-dirty="true"]`).waitFor();
      rig.gateway.retarget(second);
      await toolbar(r).locator('[data-action="save-file"]').click();
      await r.page.locator("#file-retargeted").waitFor();
      assert.equal(writes(r).length, 1);
      assert.equal(writes(r)[0].body.target, "owned", "the write named the draft's own target");
      assert.deepEqual(r.seen.failed.filter((failed) => failed.path.endsWith("/files/write")).map((failed) => failed.status), [400]);
      assert.equal(await r.page.locator("#file-conflict").count(), 0, "not an mtime conflict");
      assert.equal(await r.page.locator('[data-action="overwrite-file"]').count(), 0, "no force-overwrite offered");
      assert.equal(await toolbar(r).locator('[data-action="save-file"]').isDisabled(), true);
      assert.equal(await r.page.locator(`.pi-tab[data-path="${file}"]`).getAttribute("data-dirty"), "true", "the draft is still dirty");
      assert.match(await toolbar(r).locator(".cm-content").textContent(), /-draft/u, "the draft text is still shown");
      assert.equal(await readFile(file, "utf8"), "original\n", "nothing reached the file");
      await r.page.waitForTimeout(500);
      assert.equal(await toolbar(r).locator('[data-action="save-file"]').getAttribute("data-loading"), null, "the refused save is not left spinning");
      await r.shot("11-stale-save-refused");
    }],
    ["the captured old-target write and delete, replayed after the move, are refused and change nothing", async () => {
      const r = state.retarget;
      const captured = writes(r)[0].body;
      const refused = await post("write", captured);
      assert.equal(refused.status, 400);
      assert.equal(refused.json.code, "INVALID_REQUEST");
      assert.equal(refused.json.details.reason, "target-mismatch");
      assert.equal(refused.json.details.target, "owned2");
      const removal = await post("delete", { target: "owned", path: file });
      assert.deepEqual([removal.status, removal.json.details?.reason], [400, "target-mismatch"]);
      assert.equal(await readFile(file, "utf8"), "original\n", "the same-named file on the new target is untouched");
      await r.page.waitForTimeout(500);
      assert.equal(writes(r).length, 1, "the page did not retry");
      await toolbar(r).locator('[data-action="save-file"]').click({ force: true, timeout: 1500 }).catch(() => {});
      assert.equal(writes(r).length, 1, "a second save attempt sends nothing");
    }],
    ["a tree delete from the stale page is refused too, with a visible notice", async () => {
      const r = state.retarget;
      await r.menuOn(file, "delete");
      await r.page.locator("#confirm-file-delete").click();
      await r.page.locator("#files-panel [role=alert]").waitFor();
      assert.equal(await exists(file), true);
      assert.ok(r.seen.failed.some((failed) => failed.path.endsWith("/files/delete") && failed.status === 400));
      await r.shot("12-stale-delete-refused");
    }],
    ["the page learns the new target: tree restarts on the new cwd, the draft stays, reload binds to the new target", async () => {
      const r = state.retarget;
      await r.environment(second);
      await r.row(seed.at("proj2/only-on-second.txt")).waitFor();
      assert.equal(await r.row(file).count(), 0, "no listing of the old tree survives");
      assert.equal(await r.page.locator("[data-abs-path]").getAttribute("data-abs-path"), second.cwd);
      assert.equal(await r.page.locator(`.pi-tab[data-path="${file}"]`).getAttribute("data-dirty"), "true");
      await r.page.locator("#file-retargeted").waitFor();
      await r.shot("13-after-environment");
      await r.page.locator('#file-retargeted [data-action="reload-file"]').click();
      await r.page.locator("#file-retargeted").waitFor({ state: "detached" });
      await r.waitText(file, "original");
      const reads = r.fileRequests().filter((request) => request.path.endsWith("/files/read"));
      assert.equal(reads.at(-1).body.target, "owned2", "reload names the new target");
      await r.typeInto(file, "+new");
      await toolbar(r).locator('[data-action="save-file"]').click();
      await r.page.locator(`.pi-tab[data-path="${file}"][data-dirty]`).waitFor({ state: "detached" });
      assert.equal(writes(r).at(-1).body.target, "owned2");
      assert.equal(await readFile(file, "utf8"), "original\n+new");
    }],
    ["old responses arriving late (paused daemon) change nothing in the new context", async () => {
      const r = state.retarget;
      rig.gateway.retarget(back); await r.environment(back);
      await r.row(file).waitFor();
      await r.page.locator('#file-retargeted [data-action="reload-file"]').click();
      await r.page.locator("#file-retargeted").waitFor({ state: "detached" });
      await r.typeInto(file, "-late");
      await r.page.locator(`.pi-tab[data-path="${file}"][data-dirty="true"]`).waitFor();
      rig.stoppedPid = rig.fixture.sentinel.info.pid;
      await rig.fixture.observe(`kill -STOP ${rig.stoppedPid}\n`);
      await toolbar(r).locator('[data-action="save-file"]').click();
      await r.row(seed.at("proj")).locator(".pi-files-row").click();
      await r.page.waitForTimeout(500);
      rig.gateway.retarget(third); await r.environment(third);
      await r.row(seed.at("proj2/only-on-second.txt")).waitFor();
      assert.equal(await r.page.locator("#file-retargeted").count(), 1);
      await rig.fixture.observe(`kill -CONT ${rig.stoppedPid}\n`);
      rig.stoppedPid = 0;
      await until(async () => (await readFile(file, "utf8")).endsWith("-late"), "the old write completes on the old target");
      await r.page.waitForTimeout(800);
      assert.equal(await r.page.locator(`.pi-tab[data-path="${file}"]`).getAttribute("data-dirty"), "true", "the late save response did not mark the draft saved");
      assert.equal(await r.page.locator("#file-retargeted").count(), 1);
      assert.equal(await r.row(seed.at("proj/README.md")).count() + await r.row(seed.at("proj/src")).count(), 0, "the late listing of the old tree did not land");
      assert.equal(await r.page.locator("[data-abs-path]").getAttribute("data-abs-path"), third.cwd);
      await r.shot("14-late-old-responses");
      await r.page.locator('#file-retargeted [data-action="reload-file"]').click();
      await r.page.locator("#file-retargeted").waitFor({ state: "detached" });
      await r.waitText(file, "-late");
      assert.equal(await r.page.locator(`.pi-tab[data-path="${file}"]`).getAttribute("data-dirty"), null, "after the explicit reload the tab is clean");
    }],
    ["phone view: the same refusal shows the banner and keeps the draft", async () => {
      const p = state.phone = await openPage(rig, { name: "phone", compact: true, ...third });
      await p.row(seed.at("proj2/only-on-second.txt")).waitFor();
      await p.shot("15-phone-tree");
      await p.row(seed.at("proj2/only-on-second.txt")).locator(".pi-files-row").click();
      await p.waitText(seed.at("proj2/only-on-second.txt"), "second");
      await p.typeInto(seed.at("proj2/only-on-second.txt"), "+phone");
      rig.gateway.retarget(back);
      await p.editor(seed.at("proj2/only-on-second.txt")).locator('[data-action="save-file"]').click();
      await p.page.locator("#file-retargeted").waitFor();
      assert.equal(await readFile(seed.at("proj2/only-on-second.txt"), "utf8"), "second\n");
      assert.match(await p.editor(seed.at("proj2/only-on-second.txt")).locator(".cm-content").textContent(), /\+phone/u);
      await p.page.waitForTimeout(500);
      assert.equal(await p.editor(seed.at("proj2/only-on-second.txt")).locator('[data-action="save-file"]').getAttribute("data-loading"), null);
      await p.shot("16-phone-retargeted");
    }],
  ];
}

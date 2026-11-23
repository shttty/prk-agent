// ── layout store: saved per key as JSON, wrong or damaged values read as the default, reset clears exactly the table ──
// ── desktop widths: saved sizes fitted into the window, inside the card frame ──
import assert from "node:assert/strict";
import { createFileStore } from "../../../web/workspace/file-store/assemble-file-store.js";

export async function checkFilesAndDirtyState(ctx) {
{
  const api = ctx.fakeApi(new Map([["a.txt", { content: "one", mtime: 1 }], ["dir/b.txt", { content: "bee", mtime: 2 }]]));
  const gone = [];
  const store = createFileStore({ api, base: "/files", onGone: (path) => gone.push(path) });
  let notified = 0;
  store.subscribe(() => { notified += 1; });

  store.ensure("a.txt");
  assert.equal(store.get("a.txt").loading, true);
  await ctx.settle();
  assert.deepEqual([store.get("a.txt").content, store.get("a.txt").kind, store.isDirty("a.txt")], ["one", "text", false]);
  store.ensure("a.txt");
  assert.equal(api.calls.filter((call) => call.url === "read").length, 1, "opening a file twice reads it once");

  store.edit("a.txt", "two");
  assert.equal(store.isDirty("a.txt"), true);
  assert.equal(store.dirtyUnder("a.txt"), true);
  assert.equal(store.dirtyUnder("dir"), false);
  await store.save("a.txt");
  assert.equal(api.calls.at(-1).body.expectedLastModified, "1", "save sends the mtime it read");
  assert.equal(api.disk.get("a.txt").content, "two");
  assert.equal(store.isDirty("a.txt"), false);
  store.edit("a.txt", "two");
  const writes = api.calls.filter((call) => call.url === "write").length;
  await store.save("a.txt");
  assert.equal(api.calls.filter((call) => call.url === "write").length, writes, "an unchanged file is not written");

  // Another process changed the file: the save is refused, the text stays, reload/overwrite are the ways out.
  api.disk.set("a.txt", { content: "agent", mtime: 999 });
  store.edit("a.txt", "mine");
  await store.save("a.txt");
  assert.deepEqual([store.get("a.txt").conflict, store.isDirty("a.txt"), api.disk.get("a.txt").content], [true, true, "agent"]);
  await store.save("a.txt", true);
  assert.equal(api.calls.at(-1).body.expectedLastModified, undefined, "overwrite sends no mtime guard");
  assert.deepEqual([store.get("a.txt").conflict, store.isDirty("a.txt"), api.disk.get("a.txt").content], [false, false, "mine"]);
  api.disk.set("a.txt", { content: "agent2", mtime: 1000 });
  store.edit("a.txt", "mine2");
  await store.save("a.txt");
  await store.load("a.txt");
  assert.deepEqual([store.get("a.txt").content, store.isDirty("a.txt"), store.get("a.txt").conflict], ["agent2", false, false], "reload takes the disk version");

  // Typing while a save is in flight: what was typed after the request stays unsaved.
  store.edit("a.txt", "v1");
  const saving = store.save("a.txt");
  store.edit("a.txt", "v2");
  await saving;
  assert.deepEqual([api.disk.get("a.txt").content, store.get("a.txt").content, store.isDirty("a.txt")], ["v1", "v2", true]);

  // Rename/move keeps unsaved text under the new path; delete drops entries.
  store.ensure("dir/b.txt");
  await ctx.settle();
  store.edit("dir/b.txt", "bee!");
  store.remap("dir", "moved");
  assert.equal(store.get("dir/b.txt"), undefined);
  assert.deepEqual([store.get("moved/b.txt").content, store.get("moved/b.txt").name, store.isDirty("moved/b.txt")], ["bee!", "b.txt", true]);
  store.drop("moved");
  assert.equal(store.get("moved/b.txt"), undefined);
  store.forget("a.txt");
  assert.equal(store.get("a.txt"), undefined);
  assert.ok(notified > 10);

  // A tab restored from a saved layout whose file is gone is dropped (onGone); a file opened by hand shows the error.
  store.markRestored(["lost.txt"]);
  store.ensure("lost.txt");
  await ctx.settle();
  assert.deepEqual([gone, store.get("lost.txt")], [["lost.txt"], undefined]);
  store.ensure("typed.txt");
  await ctx.settle();
  assert.deepEqual([gone.length, store.get("typed.txt").error], [1, "gone"], "an explicit open of a missing file keeps the tab with the error");
}

// Same session, new execution target: drafts stay, nothing is written to the new target, old responses land nowhere.
{
  const disks = { A: new Map([["/w/a.txt", { content: "A-disk", mtime: 1 }]]), B: new Map([["/w/a.txt", { content: "B-disk", mtime: 7 }]]), C: new Map([["/w/a.txt", { content: "C-disk", mtime: 3 }]]), D: new Map([["/w/a.txt", { content: "D-disk", mtime: 9 }]]) };
  const calls = [], rejected = [];
  let current = "A"; // the session's authoritative target at the moment a request arrives at the Gateway
  const api = { post(url, body) {
    const kind = url.split("/").pop();
    // Like the Gateway: a request whose `target` is no longer the session's is refused before anything runs.
    if (body.target !== current) { rejected.push({ kind, body }); return Promise.reject(Object.assign(new Error("target"), { code: "INVALID_REQUEST", details: { reason: "target-mismatch", target: current } })); }
    return new Promise((resolve, reject) => calls.push({ kind, body, done: false, answer() {
      this.done = true;
      const file = disks[body.target].get(body.path);
      if (kind === "read") return file ? resolve({ content: file.content, format: "text", last_modified: String(file.mtime), mimetype: "text/plain", writable: true }) : reject(Object.assign(new Error("gone"), { code: "NOT_FOUND" }));
      disks[body.target].set(body.path, { content: body.content, mtime: file.mtime + 1 });
      return resolve({ last_modified: String(file.mtime + 1) });
    } }));
  } };
  const answer = async (kind) => { calls.find((call) => call.kind === kind && !call.done).answer(); await ctx.settle(); };
  const path = "/w/a.txt";
  const store = createFileStore({ api, base: "/files" });
  store.rebind("A"); // the first binding is not a move
  store.ensure(path);
  await answer("read");
  assert.deepEqual([store.get(path).content, calls[0].body.target], ["A-disk", "A"], "a read names the target the file is opened on");

  // a save is in flight when the session moves to B; its answer arrives afterwards
  store.edit(path, "draft");
  const saving = store.save(path);
  current = "B"; store.rebind("B");
  await answer("write"); await saving;
  const kept = store.get(path);
  assert.deepEqual([kept.content, kept.original, kept.lastModified, store.isDirty(path), kept.saving, kept.retargeted], ["draft", "A-disk", "1", true, false, true], "the old save neither marks the draft saved nor sets a baseline for B");
  const writes = () => calls.filter((call) => call.kind === "write").length;
  await store.save(path); await store.save(path, true);
  assert.deepEqual([writes(), store.get(path).conflict, Boolean(store.get(path).saveError)], [1, false, true], "no save or overwrite reaches the new target; it is not reported as an ordinary conflict");

  // a read still in flight when the session moves again lands nowhere; reload is the way to the new target
  store.rebind("B"); // same target: nothing changes
  const stale = store.load(path);
  current = "C"; store.rebind("C");
  await answer("read"); await stale;
  assert.deepEqual([store.get(path).content, store.get(path).loading, store.get(path).retargeted], ["draft", false, true], "a late read for the old target is ignored, the draft stays");
  const reload = store.load(path);
  await answer("read"); await reload;
  assert.deepEqual([store.get(path).content, store.isDirty(path), store.get(path).retargeted, store.get(path).saveError], ["C-disk", false, false, ""], "an explicit reload binds the file to the current target");
  store.edit(path, "c-edit");
  const savingC = store.save(path); await answer("write"); await savingC;
  assert.deepEqual([disks.C.get(path).content, calls.findLast((call) => call.kind === "write").body.target], ["c-edit", "C"], "after the reload saving goes to the current target, named in the request");

  // a failed reload keeps the draft and the retargeted marker (the editor shows the error next to the text)
  store.edit(path, "keep me");
  current = "E"; disks.E = new Map(); store.rebind("E");
  const failing = store.load(path); await answer("read"); await failing;
  assert.deepEqual([store.get(path).content, store.get(path).retargeted, Boolean(store.get(path).error), store.isDirty(path)], ["keep me", true, true, true]);

  // a file whose first read was still in flight when the session moved is read again on the new target
  const second = createFileStore({ api, base: "/files" });
  current = "C"; second.rebind("C");
  second.ensure(path);
  current = "D"; second.rebind("D");
  const pending = calls.filter((call) => !call.done && call.kind === "read");
  pending[0].answer(); await ctx.settle();
  assert.equal(second.get(path).loading, true, "the old first read did not complete the file");
  pending[1].answer(); await ctx.settle();
  assert.equal(second.get(path).content, "D-disk");

  // the Gateway has moved the session but this page has not learned it yet: the write names the draft's own target, is
  // refused (not a timestamp conflict), is not retried, the draft stays and the new target's same-named file is untouched
  current = "A"; const third = createFileStore({ api, base: "/files" });
  third.rebind("A"); third.ensure(path); await answer("read");
  third.edit(path, "mine");
  current = "B";
  await third.save(path);
  await third.save(path, true);
  assert.deepEqual(rejected.filter((entry) => entry.kind === "write").map((entry) => entry.body.target), ["A"], "the refused write named the draft's target; the forced one never left the page");
  assert.deepEqual([third.get(path).content, third.isDirty(path), third.get(path).retargeted, third.get(path).conflict, third.get(path).saving, disks.B.get(path).content], ["mine", true, true, false, false, "B-disk"]);
  // a first read refused the same way shows the notice; once the page learns the target, the file is read there
  const fourth = createFileStore({ api, base: "/files" });
  current = "A"; fourth.rebind("A"); current = "B";
  fourth.ensure(path); await ctx.settle();
  assert.deepEqual([fourth.get(path).loading, Boolean(fourth.get(path).error)], [false, true]);
  fourth.rebind("B"); await answer("read");
  assert.deepEqual([fourth.get(path).content, fourth.get(path).error], ["B-disk", ""]);
}

{
  ctx.saved.set("pi.layout.treeWidth", "333");
  ctx.saved.set("pi.layout.sessionOpen", "\"closed\"");
  ctx.saved.set("pi.layout.treePinned", "\"yes\"");
  ctx.saved.set("pi.files.showHidden", "1");
  const values = ctx.layoutStore.get();
  assert.deepEqual([values.treeWidth, values.sessionOpen, values.treePinned], [333, ctx.LAYOUT.sessionOpen, ctx.LAYOUT.treePinned], "valid values are read, others fall back");
  ctx.layoutStore.set({ treeWidth: 300, workspaceOpen: true });
  assert.deepEqual([ctx.saved.get(ctx.layoutKey("treeWidth")), ctx.saved.get(ctx.layoutKey("workspaceOpen"))], ["300", "true"]);
  assert.throws(() => ctx.layoutStore.set({ nope: 1 }), /unknown layout state/);
  const before = ctx.layoutStore.get().resets;
  ctx.layoutStore.reset();
  assert.deepEqual([...ctx.saved.keys()], ["pi.files.showHidden"], "reset removes every layout key and nothing else");
  assert.deepEqual({ ...ctx.layoutStore.get(), resets: 0 }, { ...ctx.LAYOUT, resets: 0 }, "and every value is the default again");
  assert.equal(ctx.layoutStore.get().resets, before + 1);
}

{
  // The desktop row is the session sidebar and the stage; the groups inside the stage size themselves (shell/stage).
  // The frame: a gap at the right edge, one more at the left without the sidebar.
  // no workspace: the chat card fills the row inside the frame (a hidden sidebar adds the left gap)
  assert.equal(ctx.fitWidths({ total: 1440, session: { open: true, width: 280 } }).chat, 1440 - ctx.CARD_GAP - 280);
  assert.equal(ctx.fitWidths({ total: 1440, session: { open: false, width: 280 } }).chat, 1440 - 2 * ctx.CARD_GAP);
  // too small: the session sidebar at its minimum
  assert.equal(ctx.fitWidths({ total: 600, session: { open: true, width: 400 } }).session, ctx.SESSION_MIN);
  // the session sidebar never pushes the stage under the chat's minimum, and its handle stops there
  const greedy = ctx.fitWidths({ total: 700, session: { open: true, width: 5000 } });
  assert.equal(greedy.session, 700 - ctx.CARD_GAP - ctx.CHAT_MIN);
  assert.equal(greedy.sessionRange[1], greedy.session);
  // invariants over a grid of windows and saved values (saved values are inputs only)
  for (const total of [1024, 1280, 1440, 1920, 2560]) for (const sessionOpen of [true, false]) for (const sessionWidth of [1, 280, 5000]) {
    const input = { total, session: { open: sessionOpen, width: sessionWidth } };
    const fit = ctx.fitWidths(input);
    const label = JSON.stringify(input);
    assert.equal(ctx.CARD_GAP * (sessionOpen ? 1 : 2) + fit.session + fit.chat, total, `the regions and the frame fill the row: ${label}`);
    if (sessionOpen) assert.ok(fit.session >= ctx.SESSION_MIN && fit.session <= ctx.SESSION_MAX, `session range: ${label}`);
    assert.ok(fit.chat >= ctx.CHAT_MIN, `chat minimum: ${label}`);
  }
}
}

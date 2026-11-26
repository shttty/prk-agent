import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { soulGet } from "../../../src/gateway/soul/read-soul-settings.ts";
import { soulSave } from "../../../src/gateway/soul/save-soul.ts";

const host = (home, soulFile) => ({ host: { paths: { home }, config: { session: { soulFile }, limits: { contextFileBytes: 64 } } } });

async function home(t) {
  const root = await mkdtemp(join(tmpdir(), "soul-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("saving a linked soul file replaces the link's target and keeps the link", async (t) => {
  const root = await home(t);
  await mkdir(join(root, "prompts"));
  await writeFile(join(root, "authority.md"), "Old persona.\n");
  await symlink("../authority.md", join(root, "prompts", "soul.md"));
  const ctx = host(root, "prompts/soul.md");
  const opened = soulGet(ctx);
  assert.deepEqual([opened.path, opened.content], [join(root, "prompts", "soul.md"), "Old persona.\n"]);
  const saved = soulSave(ctx, { content: "New persona.\n", revision: opened.revision });
  assert.equal(saved.content, "New persona.\n");
  assert.equal(await readlink(join(root, "prompts", "soul.md")), "../authority.md");
  assert.equal(await readFile(join(root, "authority.md"), "utf8"), "New persona.\n");
});

test("a save from a stale revision is refused and leaves the file alone; a missing file is created", async (t) => {
  const root = await home(t);
  const ctx = host(root, "prompts/soul.md");
  const empty = soulGet(ctx);
  assert.deepEqual([empty.content, empty.revision], ["", ""]);
  const first = soulSave(ctx, { content: "First.", revision: "" });
  assert.throws(() => soulSave(ctx, { content: "Stale.", revision: "" }), { code: "CONFLICT" });
  assert.throws(() => soulSave(ctx, { content: "x".repeat(65), revision: first.revision }), { code: "INVALID_REQUEST" });
  assert.equal(await readFile(join(root, "prompts", "soul.md"), "utf8"), "First.");
});

test("an empty session.soulFile reads as unconfigured and cannot be saved", async (t) => {
  const ctx = host(await home(t), "");
  assert.deepEqual(soulGet(ctx), { configured: false, path: "", content: "", revision: "", maxBytes: 64 });
  assert.throws(() => soulSave(ctx, { content: "Persona.", revision: "" }), { code: "INVALID_REQUEST" });
});

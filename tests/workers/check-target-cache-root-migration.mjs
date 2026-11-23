import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "smol-toml";
import { planMigration } from "../../scripts/config-toml-migration/plan-migration.mjs";
import { applyMigration } from "../../scripts/config-toml-migration/apply-migration.mjs";
import { loadPrkConfig } from "../../src/config/document/load-prk-config.ts";

const root = await mkdtemp(join(tmpdir(), "prk-target-cache-migration-"));
try {
  const home = join(root, "home");
  const cache = join(root, "owned-target-cache");
  await mkdir(home);
  await mkdir(join(cache, "bin"), { recursive: true });
  await writeFile(join(cache, "bin", "existing-cache"), "leave in place");
  const path = join(home, "config.toml");
  const original = stringify({ codemode: { binCacheDir: join(cache, "bin"), binChunkBytes: 32 }, session: { localTools: true } });
  await writeFile(path, original);
  await writeFile(join(home, "instances.toml"), "instances = []\n", { mode: 0o600 });
  await assert.rejects(loadPrkConfig(home), /binCacheDir.*removed.*offline/);
  const result = applyMigration(planMigration(home));
  assert.deepEqual(result, { home, migrated: ["config.toml"], backups: ["config.toml.before-target-cache-root"], unchanged: false });
  assert.equal(await readFile(join(home, "config.toml.before-target-cache-root"), "utf8"), original);
  const config = await loadPrkConfig(home);
  assert.equal(config.targetCacheRoot, cache);
  assert.deepEqual(config.codemode, { binChunkBytes: 32 });
  assert.equal(config.session.localTools, true);
  assert.equal(await readFile(join(cache, "bin", "existing-cache"), "utf8"), "leave in place", "migration never moves or deletes target caches");
  const first = await stat(path);
  assert.equal(applyMigration(planMigration(home)).unchanged, true);
  const second = await stat(path);
  assert.equal(second.ino, first.ino);
  assert.equal(second.mtimeMs, first.mtimeMs);

  for (const [name, document, expected] of [
    ["custom-path", { codemode: { binCacheDir: "/owned/custom-tools" } }, /refusing to guess.*manually/],
    ["both-keys", { targetCacheRoot: cache, codemode: { binCacheDir: "/old/bin" } }, /both.*manually/],
  ]) {
    const directory = join(root, name);
    await mkdir(directory);
    const text = stringify(document);
    await writeFile(join(directory, "config.toml"), text);
    assert.throws(() => planMigration(directory), expected);
    assert.deepEqual(await readdir(directory), ["config.toml"]);
    assert.equal(await readFile(join(directory, "config.toml"), "utf8"), text);
  }
  const occupied = join(root, "occupied-backup");
  await mkdir(occupied);
  await writeFile(join(occupied, "config.toml"), original);
  await writeFile(join(occupied, "config.toml.before-target-cache-root"), "existing backup");
  assert.throws(() => planMigration(occupied), /occupied path/);
  assert.equal(await readFile(join(occupied, "config.toml"), "utf8"), original);
  assert.throws(() => planMigration(), /explicit absolute directory/);
  console.log("PASS target cache root: offline TOML migration, unchanged caches, exact backup, idempotence, explicit no-write refusal");
} finally {
  await rm(root, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { migrateCacheRoot } from "../../../scripts/config-toml-migration/migrate-cache-root.mjs";

test("target cache root is global, target-relative only for ~/ and explicitly migrates the removed binary key", () => {
  assert.equal(parsePrkConfig({}).targetCacheRoot, "~/.cache/prk");
  assert.deepEqual(parsePrkConfig({}).codemode, { binChunkBytes: 1048576 });
  for (const path of ["/owned/cache", "/owned/cache with spaces/", "~/owned-cache", "~/", "/"]) {
    assert.equal(parsePrkConfig({ targetCacheRoot: path }).targetCacheRoot, path);
  }
  for (const value of [null, false, 1, {}, [], "", " ", "relative/cache", "~", "~other/cache", "/cache\n", "~/cache\0"]) {
    assert.throws(() => parsePrkConfig({ targetCacheRoot: value }), /targetCacheRoot.*absolute target path/);
  }
  assert.throws(() => parsePrkConfig({ codemode: { binCacheDir: "~/.cache/prk/bin" } }), /binCacheDir.*removed.*stop Gateway.*migrate-config-toml.*offline/);
  for (const [old, root] of [["/owned/cache/bin", "/owned/cache"], ["~/.cache/prk/bin///", "~/.cache/prk"], ["~/bin", "~/"], ["/bin", "/"]]) {
    const before = { session: { localTools: true }, codemode: { binCacheDir: old, binChunkBytes: 32 } };
    const migrated = migrateCacheRoot(before);
    assert.deepEqual(migrated, { session: before.session, codemode: { binChunkBytes: 32 }, targetCacheRoot: root });
    assert.equal(before.codemode.binCacheDir, old, "planning does not mutate its input");
    assert.equal(parsePrkConfig(migrated).targetCacheRoot, root);
  }
  for (const old of ["/owned/custom-tools", "relative/bin", "~user/cache/bin", "", null, "/cache\n/bin"]) {
    assert.throws(() => migrateCacheRoot({ codemode: { binCacheDir: old } }), /refusing to guess.*Set targetCacheRoot explicitly/);
  }
  assert.throws(() => migrateCacheRoot({ targetCacheRoot: "/chosen", codemode: { binCacheDir: "/old/bin" } }), /both.*remove the old key manually/);
});

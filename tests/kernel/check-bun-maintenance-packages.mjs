import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { validateRequest } from "../../src/gateway/wire/validate-request.ts";
import { parseInstanceConfig } from "../../src/config/execution-target/parse-instance-config.ts";
import { withBunOwner, text } from "./fixtures/create-bun-owner.mjs";

await withBunOwner(async (_owner, original) => {
  function request(params) { return validateRequest({ v: 1, id: 1, method: "deployTargetEnvironment", params }); }
  assert.throws(() => request({ target: "local", bunPackages: { "prk-test": "latest" } }), { code: "INVALID_REQUEST" });
  assert.deepEqual(request({ target: "local", bunPackages: { "prk-test": "1.0.0" } }).params.bunPackages, { "prk-test": "1.0.0" });
  const { prepareBunPackages } = await import("../../src/kernel/process/prepare-bun-packages.ts");
  const contents = new Map();
  for (const version of ["1.0.0", "2.0.0", "3.0.0"]) {
    const folder = join(original.cwd, version);
    const name = "prk-test";
    const manifest = { name, version, type: "module", main: "index.js", exports: { ".": "./index.js", "./extra": "./extra.js" },
      ...(version === "3.0.0" ? { optionalDependencies: { "prk-linux-native": "1.0.0" } } : {}) };
    await mkdir(join(folder, "package"), { recursive: true });
    await writeFile(join(folder, "package/package.json"), JSON.stringify(manifest));
    await writeFile(join(folder, "package/index.js"), version === "3.0.0" ? "import 'prk-linux-native'; export default 'bad';" : `export default '${version}'`);
    await writeFile(join(folder, "package/extra.js"), `export default '${version}-extra'`);
    contents.set(version, { manifest, tgz: execFileSync("tar", ["czf", "-", "-C", folder, "package"]) });
  }
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    const path = req.url;
    if (path === "/prk-test") return res.end(JSON.stringify({ name: "prk-test", "dist-tags": { latest: "3.0.0" }, versions: Object.fromEntries([...contents].map(([version, { manifest, tgz }]) => [version, {
      ...manifest, dist: { tarball: `${url}/prk-test/-/${version}.tgz`, integrity: `sha512-${createHash("sha512").update(tgz).digest("base64")}` },
    }])) }));
    const tarball = /^\/prk-test\/-\/(.*)\.tgz$/u.exec(path);
    if (tarball && contents.has(tarball[1])) return res.end(contents.get(tarball[1]).tgz);
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const target = { id: "local", label: "Fixture", cwd: original.cwd, local: true, bunPackages: { registry: url, scopes: { "@internal": url } } };
  assert.deepEqual(parseInstanceConfig([target])[0].bunPackages, target.bunPackages);
  assert.throws(() => validateRequest({ v: 1, id: 1, method: "addTarget", params: {
    target: { ...target, bunPackages: { registry: url, token: "not-an-input" } },
  } }), { code: "INVALID_REQUEST" });
  const configuration = { ...original, bun: { ...original.bun, packages: { ...target.bunPackages, cacheRoot: join(original.cwd, "target-cache") } } };
  const old = createPythonTool(configuration);
  let second, offline;
  const execute = (owner) => owner.executeForeground("read-package", { code: "return (await cell.import('prk-test')).default" });
  const prepare = async (version) => {
    const lease = await original.acquire();
    try { return await prepareBunPackages(configuration, lease, { "prk-test": version }, AbortSignal.timeout(20000)); }
    finally { await lease.release(); }
  };
  try {
    await prepare("1.0.0");
    const root = join(configuration.bun.packages.cacheRoot, "bun-packages/local");
    const [source] = await readdir(root);
    const published = join(root, source, "current");
    assert.match(await readFile(join(published, "bun.lock"), "utf8"), /prk-test@1\.0\.0/);
    const first = await execute(old);
    assert.equal(first.details.outcome, "ok", text(first));
    assert.match(text(first), /1\.0\.0/);
    await prepare("2.0.0");
    await assert.rejects(prepare("3.0.0"), /Bun package verification failed/);
    const requestCount = requests;
    const pinned = await old.executeForeground("read-new-subpath", { code: "return (await cell.import('prk-test/extra')).default" });
    assert.match(text(pinned), /1\.0\.0-extra/, "running generation switched its package set");
    assert.equal(requests, requestCount);
    await new Promise((resolve) => server.close(resolve));
    second = createPythonTool(configuration);
    const next = await execute(second);
    assert.equal(next.details.outcome, "ok", text(next));
    assert.match(text(next), /2\.0\.0/, "failed publication replaced the last verified set");
    offline = createPythonTool({ ...configuration, bun: { ...configuration.bun, packages: undefined } });
    await assert.rejects(execute(offline), /No prepared Bun package set/);
    assert.equal(requests, requestCount);
  } finally {
    server.close();
    await Promise.all([old.close(), second?.close(), offline?.close()]);
  }
});
console.log("PASS: target Bun lock, verified import, failed publication, pinned generation, offline runtime");

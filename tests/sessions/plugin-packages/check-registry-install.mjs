import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkRegistryInstall(root, api) {
  const directory = join(root, "registry-source");
  await mkdir(directory);
  const name = "@prk-tests/registry-plugin";
  const version = "1.0.0";
  await writeFile(join(directory, "package.json"), JSON.stringify({ name, version, type: "module", files: ["index.mjs"], pi: { extensions: ["index.mjs"] } }));
  await writeFile(join(directory, "index.mjs"), 'export default pi => pi.registerCommand("registry-ping", {handler: async (_args,ctx) => ctx.ui.notify("registry")});\n');
  const packed = JSON.parse((await promisify(execFile)("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", root], { cwd: directory })).stdout);
  const tarball = await readFile(join(root, packed[0].filename));
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    if (request.url === "/package.tgz") { response.setHeader("content-type", "application/octet-stream"); response.end(tarball); return; }
    if (decodeURIComponent(request.url).split("?")[0] !== `/${name}`) { response.writeHead(404); response.end(); return; }
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ name, "dist-tags": { latest: version }, versions: { [version]: { name, version, dist: { tarball: `http://127.0.0.1:${server.address().port}/package.tgz` } } } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = { registry: process.env.npm_config_registry, scripts: process.env.npm_config_ignore_scripts, offline: process.env.PI_OFFLINE };
  process.env.npm_config_registry = `http://127.0.0.1:${server.address().port}`;
  process.env.npm_config_ignore_scripts = "true";
  delete process.env.PI_OFFLINE;
  try {
    const installed = await api("/plugins/install", { source: `${name}@${version}` });
    assert.equal(installed.response.status, 200, JSON.stringify(installed.value));
    const pkg = installed.value.packages.find((entry) => entry.source === `npm:${name}@${version}`);
    assert(pkg);
    assert.equal(pkg.location, "gateway");
    assert.deepEqual(pkg.commands.map(({ name }) => name), ["registry-ping"]);
    assert(requests.includes("/package.tgz"), "native package manager downloaded the real owned archive");
    const beforeDuplicate = requests.length;
    const duplicate = await api("/plugins/install", { source: name, location: "host" });
    assert.equal(duplicate.response.status, 409, JSON.stringify(duplicate.value));
    assert.equal(requests.length, beforeDuplicate, "native identity rejection precedes npm side effects");
    const wrongSource = await api("/plugins/uninstall", { source: `npm:${name}`, confirm: true });
    assert.equal(wrongSource.response.status, 404, JSON.stringify(wrongSource.value));
    assert.deepEqual((await api("/plugins")).value.packages.find((entry) => entry.source === pkg.source).commands.map(({ name }) => name), ["registry-ping"]);
    const removed = await api("/plugins/uninstall", { source: pkg.source, confirm: true });
    assert.equal(removed.response.status, 200, JSON.stringify(removed.value));
    console.log(JSON.stringify({ npm: pkg.source, registryRequests: requests, location: pkg.location }));
  } finally {
    for (const [key, value] of [["npm_config_registry", previous.registry], ["npm_config_ignore_scripts", previous.scripts], ["PI_OFFLINE", previous.offline]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

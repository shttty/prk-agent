import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePluginPackage } from "../../src/plugins/packages/resolve-package.ts";

const root = await mkdtemp(join(tmpdir(), "prk-plugrow-"));
const agentDir = join(root, "agent");
const resolve = (source) => resolvePluginPackage({ source, enabled: true, location: "gateway" }, root, agentDir);
const manifest = async (path, value) => {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "package.json"), JSON.stringify(value));
};
try {
  const local = join(root, "local");
  await manifest(local, { name: "local-probe", version: "0.0.1" });
  await manifest(join(agentDir, "npm/node_modules/@probe/plugin"), { name: "@probe/plugin", version: "2.3.4" });
  await manifest(join(agentDir, "git/github.com/probe/plugin"), { name: "git-probe", version: "3.4.5" });
  const cases = [
    [local, "local", "0.0.1", local.startsWith(`${homedir()}/`) ? `~${local.slice(homedir().length)}` : local],
    ["npm:@probe/plugin@^2", "npm", "2.3.4", "@probe/plugin@^2"],
    ["git:github.com/probe/plugin@main", "git", "3.4.5", "github.com/probe/plugin@main"],
    ["https://github.com/probe/plugin", "git", "3.4.5", "https://github.com/probe/plugin"],
    ["ssh://git@github.com/probe/plugin", "git", "3.4.5", "ssh://git@github.com/probe/plugin"],
    ["git://github.com/probe/plugin", "git", "3.4.5", "git://github.com/probe/plugin"],
  ];
  for (const [source, sourceKind, version, sourceDisplay] of cases) {
    const pkg = resolve(source);
    assert.equal(pkg.source, source);
    assert.equal(pkg.sourceKind, sourceKind);
    assert.equal(pkg.version, version);
    assert.equal(pkg.sourceDisplay, sourceDisplay);
  }
  assert.equal(resolve(homedir()).sourceDisplay, "~");
  const sibling = `${homedir()}-plugrow-missing`;
  assert.equal(resolve(sibling).sourceDisplay, sibling);
  for (const value of [undefined, "", 123]) {
    await manifest(local, { name: "local-probe", version: value });
    assert.equal(Object.hasOwn(resolve(local), "version"), false);
  }
  await rm(join(local, "package.json"));
  assert.equal(Object.hasOwn(resolve(local), "version"), false);
  console.log("PASS plugin row metadata: installed versions, local/npm/git sources, Gateway home boundary, missing versions");
} finally {
  await rm(root, { recursive: true, force: true });
}
